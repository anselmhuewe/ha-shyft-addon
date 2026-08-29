# Demo-Dashboard-Daten

Fehlen hier noch `demo_input.csv` und `demo_output.csv` (siehe `_load_demo_dashboard_data`,
`sync_dashboard_chart_data` in `app.py`).

Solange kein echter `shyft_access_key` hinterlegt ist (`is_demo_mode()` in `app.py`), ruft das
Addon nie Bubble auf - auch nicht für die Dashboard-Charts. Stattdessen liest
`sync_dashboard_chart_data()` diese beiden statischen Dateien und schreibt sie in denselben Cache
(`DASHBOARD_CACHE_PATH`), den es sonst aus der `provide_input_output_csv`-Antwort von shyft-power
befüllt - exakt dasselbe Format wie eine echte Antwort:

- `demo_input.csv`: genau das `input_csv`, das der Optimizer für einen Lauf bekommen hat (dieselben
  Spalten wie in `optimizer_in.ftl` im `shyft`-Repo, `;`-getrennt).
- `demo_output.csv`: das dazugehörige `output_csv` (Optimizer-Ergebnis).

`creation_date` wird beim Einlesen automatisch auf die aktuelle volle Stunde gesetzt - die
Beispieldaten müssen also nicht "frisch" gehalten werden, wirken aber bei jedem hourly Sync wieder
aktuell.

Einfach beide Dateien hier ablegen, kein weiterer Code nötig.
