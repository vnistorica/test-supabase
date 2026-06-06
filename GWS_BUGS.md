# GWS Bug Reports

Found while bringing up a Next.js + PostgREST + PostgreSQL stack with `gws up`.

**Environment**
- `gws` at `/home/vlad/.gws/bin/gws`
- Backend: k3d (k3s v1.31.14+k3s1), local registry `gws-local-registry` (`localhost:5000`)
- Platform: Linux
- Project: `supabase-test` (3 services: `web`, `postgrest`, `postgres`)

---

## A. `gws up` silently half-rewrites a non-conforming image into an unresolvable tag

**Severity:** High — silent failure, cost the most debugging time. (Second priority after C:
C blocks a category by design; A has a clean canonical fix once you know the convention.)

**Important context / what the convention actually is**
The canonical manifest form is the **bare service name** + `imagePullPolicy: IfNotPresent`,
which `gws generate-template <fw> deployment` emits and which `gws up` fully substitutes to
the built artifact (`localhost:5000/web:v1-<hash>`):
```yaml
image: web
imagePullPolicy: IfNotPresent
```
The gws-setup skill already prescribes this (generate manifests via `gws generate-template`)
and explicitly warns against `imagePullPolicy: Never` with registry-scoped images. So this
is **not** a gws-setup-skill gap — the skill is correct. The manifests in this project
(`image: local/supabase-test/web:latest` + `imagePullPolicy: Never`, present since the very
first commit) did not come from following that skill; they were hand-authored and copied the
exact anti-pattern the skill says to avoid.

**The actual gws *tool* bug**
Given a non-conforming image, `gws up` does not reject it — it does a **partial, tag-naive
rewrite**: it maps the host (`local/supabase-test/web` → `localhost:5000/web`) but keeps the
original tag (`:latest`), while the build is pushed as `localhost:5000/web:v1-<hash>`. The
pod then requests `localhost:5000/web:latest`, which exists nowhere (registry only has
`web:v1-<hash>`; the node has neither).

So there are two code paths that disagree:
- bare `image: web` → full substitution (host **and** correct tag) ✓
- `image: local/<proj>/<svc>:latest` → host-only rewrite, stale tag preserved ✗

**Symptoms**
- `ErrImageNeverPull` (manifest also had `imagePullPolicy: Never`) / `ImagePullBackOff`.
- `gws up` reports **"Deployment completed successfully!"** anyway — no warning that the
  resulting image reference can't resolve.

**Expected — should gws always substitute?**
Yes. `gws up` should deterministically resolve each service's primary-container image to the
actual built artifact (host **and** tag) regardless of the placeholder form, **or** validate
the image reference at deploy time and fail loudly when it won't resolve to the built image —
instead of the current silent host-only half-rewrite. As-is, the partial rewrite is worse
than doing nothing because it masks the mistake.

**Workaround**
Use the canonical form so gws fully substitutes it:
```yaml
image: web
imagePullPolicy: IfNotPresent
```

---

## B. Next.js (node) workspace mount shadows image-installed `node_modules` — broken out of the box

**Severity:** High — affects the most common framework; reproduces with gws's own template.

**What happens**
For a `fileSync: true` service, gws mounts the `gws-workspace` PVC at the Dockerfile
`WORKDIR` (e.g. `/app`) with no `subPath`. `node_modules/` is excluded from file sync
(correctly — platform/arch mismatch), so the PVC has no `node_modules`. The mount
**shadows** the `node_modules` the image installed at `/app/node_modules`.

Result at runtime:
```
> next dev --hostname 0.0.0.0
sh: next: not found
```
Verified the image *does* contain `/app/node_modules/.bin/next`; it's just hidden by the
PVC mount. There is no init/seed container to preserve or rehydrate deps.

**Reproduces with gws's own template**
`gws generate-template nextjs-app-router dockerfile` produces the same
`WORKDIR /app` + `npm install` + `CMD ["npx","next",...]` pattern, which hits this.

**Expected**
Out-of-the-box node setup should keep deps available — e.g. an init container that copies
the image's `node_modules` into the workspace/an anonymous volume, mount `node_modules` on
a separate volume, or document a required runtime install.

**Workaround**
Install deps into the mounted workspace on first start (PVC persists, so it's one-time):
```dockerfile
CMD ["sh", "-c", "if [ ! -x node_modules/.bin/next ]; then npm install; fi; exec npm run dev"]
```

---

## C. Build linter can't represent prebuilt third-party images (BIGGEST / most fundamental)

**Severity:** High — this is the top-priority bug. Unlike A (a manifest-form mistake with a
clean canonical fix) and B (fixable per-service), C **blocks an entire category of services
by design** with no clean escape hatch. Any legitimately prebuilt upstream image —
PostgREST, nginx, redis, minio, mailhog, adminer, a vendored API gateway, etc. — that you
deploy with `fileSync: false` (correct, since there's no source to hot-reload) cannot be
built without faking source.

**Confirmed: no escape hatch exists.** The gws.json service schema exposes only
`dockerfile`, `buildArgs`, `manifests`, `fileSync`, `fileSyncIgnore`, `watch` — there is **no**
`prebuilt` / `selfContained` / `expectsSource` / `skipBuild` flag. The check is a hard throw:
`if (fileSync === false && !hasSourceMaterializingCopy(dockerfile)) throw`. The only ways past
it are both wrong:
- fake a source `COPY` (pollutes the image with files it doesn't use), or
- set `fileSync` to anything but `false` (schema default is `true`) — which attaches a
  workspace PVC mount + sync session to a stateless prebuilt service that shouldn't have one.

**What happens**
A service with `fileSync: false` whose Dockerfile is a complete upstream image
(`FROM postgrest/postgrest:v12.2.0`) with no source-materializing `COPY` is rejected:

```
[IMAGE-BUILD] Service 'postgrest' has fileSync: false but its Dockerfile contains no
source-materializing COPY instruction. The deployed image will contain no application
source code. Add 'COPY . .' ... or use the .selfContained Dockerfile variant generated by
'gws generate-template'.
```

The image is intentionally self-contained (binary baked into the base image, configured
via env vars). The suggested `.selfContained` escape only exists for **templated
frameworks** — there is no postgrest framework, and the check has no per-service override.

**Expected**
A first-class way to declare a service's image as prebuilt/self-contained so the linter is
skipped without faking a `COPY` and without enabling file sync. Options:
- a gws.json service flag, e.g. `prebuilt: true` (or `expectsSource: false`), that suppresses
  this check while keeping `fileSync: false`; and/or
- auto-detect: a Dockerfile that is purely `FROM <upstream>` (+ `EXPOSE`/`ENV`/`CMD`, no
  `RUN`/`COPY` build steps) is self-evidently prebuilt and should not require source.

Either way, the check should be a warning rather than a hard build failure for this shape.

**Workaround**
Added a real config file and `COPY` it just to satisfy the linter:
```dockerfile
FROM postgrest/postgrest:v12.2.0
COPY .gws/services/postgrest/postgrest.conf /etc/postgrest.conf
EXPOSE 3000
```

---

## D. Manifests-only service has its image force-rewritten

**Severity:** Medium.

**What happens**
A service with **no `dockerfile`** (only `manifests`) and an explicit public image in its
deployment still has its container image overridden to `localhost:5000/<svc>:latest`:

- Manifest: `image: postgrest/postgrest:v12.2.0`
- Running pod: `localhost:5000/postgrest:latest` → `ImagePullBackOff` (never built/pushed)

This makes it impossible to deploy a service that just references a public upstream image
via manifests (the way `helm:` services work without a Dockerfile).

**Expected**
For a service without a `dockerfile`, respect the image specified in its manifests rather
than rewriting it to the local-registry tag.

**Workaround**
Give the service a (degenerate) Dockerfile so gws actually builds and pushes
`localhost:5000/<svc>:latest` — but that runs into bug **C** above.

---

## Minor notes (not filed as bugs, FYI)

- **Bitnami image 404.** The bitnami PostgreSQL chart (`15.5.38`) pins
  `bitnami/postgresql:16.4.0-debian-12-r14`, which Bitnami removed from the public
  `bitnami/*` Docker Hub repos (mid-2025 migration). Pull fails with `not found`. Worked
  around by overriding `image.repository: bitnamilegacy/postgresql` +
  `global.security.allowInsecureImages: true`. If `gws-setup` generates bitnami helm
  values, it should target `bitnamilegacy` or a still-published tag.
- **Helm failure masks root cause.** A bad image surfaced only as
  `Error: UPGRADE FAILED: context deadline exceeded` (helm `--wait` timeout); the actual
  `ImagePullBackOff` had to be found via `kubectl describe`. Surfacing the pod's pull error
  would help.
- **Stuck StatefulSet pod after image fix.** After correcting the postgres image, the
  existing `postgres-postgresql-0` pod (in `ImagePullBackOff`) was not rolled to the new
  spec automatically; had to `kubectl delete pod` it.
