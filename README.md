# JLPT Vocabulary Quiz

Static JLPT vocabulary practice app. The home page lists JLPT levels, each
level reads its course catalog from `dataset/<level>/courses.json`, and each
course points to a text dataset in the same folder.

## Run locally

Serve the repository root over HTTP (ES modules and dataset fetches do not work
from `file://` URLs), for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Routes are stored in the URL hash, so direct
links and browser refresh work on static hosting:

- `#/` — Home and level list
- `#/level/n3` — courses for a level
- `#/renshuu/n3/tong-hop-tu-vung-n3` — selected course practice page

## Add a course

1. Put the course dataset in `dataset/<level>/`.
2. Add an entry to that level's `courses.json`:

   ```json
   {
     "id": "course-slug",
     "name": "Course name",
     "description": "Optional course summary.",
     "dataset": "course-file.txt"
   }
   ```

The dataset keeps the existing eight-column `*`-delimited format. Course IDs
must be lowercase URL slugs, and the dataset filename must be a `.txt` file in
the same level folder. Each course has an independent saved practice session.
