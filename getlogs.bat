gcloud logging read "resource.type=build AND resource.labels.build_id=d8f7ebfb-5e5a-44df-a3f7-fe28d46719fa" --limit 50 --format=json > logs.json
