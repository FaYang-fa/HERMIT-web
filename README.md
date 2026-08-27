---
title: HERMIT
emoji: 🧬
colorFrom: blue
colorTo: red
sdk: docker
app_port: 7860
fullWidth: true
header: mini
short_description: Interactive RNA, 5hmC, and 5mC visualization
---

# HERMIT

**Harmonized Embedding of RNA and Methylation for Integration and Translation**

This Docker Space visualizes the integrated latent representation of 30,000
paired single cells measured across RNA, 5hmC, and 5mC. Each cell contributes
one point per modality, producing 90,000 UMAP points in total.

The Space contains paired three-omics cells only. It does not use additional RNA
cells, unpaired 5hmC cells, or `integration_results_annotated.csv`.

## Features

- WebGL UMAP rendering for paired RNA, 5hmC, and 5mC representations
- coloring by modality or modality-specific subclass annotation
- subclass search and multi-selection
- point-size and opacity controls
- modality coverage comparison by subclass
- interactive side-gutter connections on wide screens

## Local Docker run

```bash
docker build -t hermit-space .
docker run --rm -p 7860:7860 hermit-space
```

Open `http://localhost:7860`.

## Repository structure

```text
.
|-- Dockerfile
|-- app.py
|-- requirements.txt
|-- templates/
|   |-- index.html
|   `-- 404.html
|-- static/
|   |-- css/style.css
|   `-- js/main.js
`-- data/web_data/
    |-- umap_data.json
    `-- umap_data.csv
```

## Data scope

The visualization payload contains 30,000 unique cell identifiers. Every cell
identifier has exactly one RNA point, one 5hmC point, and one 5mC point.
Subclass annotations are attached to individual modality points, matching the
source visualization data.
