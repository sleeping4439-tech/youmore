CREATE TABLE IF NOT EXISTS strokes (id INTEGER PRIMARY KEY AUTOINCREMENT, sheet TEXT NOT NULL, color TEXT NOT NULL, points TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_strokes_sheet_id ON strokes(sheet,id);


CREATE TABLE IF NOT EXISTS canvas_entries (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 sheet INTEGER NOT NULL,
 id TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 1600),
 bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 32000),
 UNIQUE(sheet,id)
);
CREATE INDEX IF NOT EXISTS canvas_entries_sheet_seq ON canvas_entries(sheet,seq);
CREATE TRIGGER IF NOT EXISTS canvas_guard BEFORE INSERT ON canvas_entries
BEGIN
 SELECT CASE WHEN NEW.sheet != CAST((unixepoch()-313200)/604800 AS INTEGER) THEN RAISE(ABORT,'canvas_week') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM canvas_entries WHERE sheet=NEW.sheet AND id=NEW.id) AND
 ((SELECT COALESCE(SUM(points),0) FROM canvas_entries WHERE sheet=NEW.sheet)+NEW.points>150000 OR
 (SELECT COALESCE(SUM(bytes),0) FROM canvas_entries WHERE sheet=NEW.sheet)+NEW.bytes>4000000 OR
 (SELECT COUNT(*) FROM canvas_entries WHERE sheet=NEW.sheet)>=3000)
 THEN RAISE(ABORT,'canvas_capacity') END;
END;
