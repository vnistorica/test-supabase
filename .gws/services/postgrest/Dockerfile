FROM postgrest/postgrest:v12.2.0
# PostgREST ships as a prebuilt binary in the base image; runtime config is
# provided via PGRST_* env vars in the K8s deployment. We materialize a baseline
# config into the image so the build is self-contained.
COPY .gws/services/postgrest/postgrest.conf /etc/postgrest.conf
EXPOSE 3000
