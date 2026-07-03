-- ============================================================================
-- NO.ID RECORDS — media_embeds seed (fase 2)
--
-- Mirror of src/data/mediaEmbeds.ts at fase-2 time: the original page's
-- curation plus the label's newest releases/sessions (embed IDs verified
-- live, jul 2026). Idempotent: only seeds when the table is empty, so later
-- edits from the dashboard are never clobbered by a re-run.
-- ============================================================================

insert into public.media_embeds (platform, title, meta, embed_url, height, position, active)
select v.*
from (
  values
    -- BANDCAMP — original three (exact heights) + newest releases
    ('bandcamp', 'El Caminante Escarpado', 'Alex Jockey · EL MAMU',
     'https://bandcamp.com/EmbeddedPlayer/album=2060091611/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 1, true),
    ('bandcamp', 'Singularidad del Decidir', 'Tav Shvi',
     'https://bandcamp.com/EmbeddedPlayer/album=4154602261/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 2, true),
    ('bandcamp', 'Align', 'Lea Node',
     'https://bandcamp.com/EmbeddedPlayer/album=1712326544/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 3, true),
    ('bandcamp', 'En Voz Alta', 'Sara Delirio',
     'https://bandcamp.com/EmbeddedPlayer/album=2333324377/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 4, true),
    ('bandcamp', 'Various Artists II', 'V/A',
     'https://bandcamp.com/EmbeddedPlayer/album=1905391289/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 786, 5, true),
    ('bandcamp', 'Des Sombres et des Lumières', 'EL MAMU',
     'https://bandcamp.com/EmbeddedPlayer/album=1742511145/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 555, 6, true),
    ('bandcamp', 'Noise Sample Pack', 'V/A',
     'https://bandcamp.com/EmbeddedPlayer/album=3754413479/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 7, false),
    ('bandcamp', 'Out Of Boundaries', 'Caotical Disordah',
     'https://bandcamp.com/EmbeddedPlayer/album=192374016/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 8, false),
    ('bandcamp', 'Revuelto de Emociones', '9 8 r p m',
     'https://bandcamp.com/EmbeddedPlayer/album=13855334/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 9, false),
    ('bandcamp', 'Fi-Lo', 'Dunkelheit · EL MAMU · Sinistermind',
     'https://bandcamp.com/EmbeddedPlayer/album=3846456354/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 10, false),
    ('bandcamp', 'Baile Lumínico', 'ÆTERIS',
     'https://bandcamp.com/EmbeddedPlayer/album=2204012792/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 11, false),
    ('bandcamp', 'Soul Dance', 'ZEWA',
     'https://bandcamp.com/EmbeddedPlayer/album=743011242/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 12, false),
    ('bandcamp', 'No.ID (Remix Contest)', 'Tav Shvi',
     'https://bandcamp.com/EmbeddedPlayer/album=3498475324/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 13, false),
    ('bandcamp', 'Various Artists I', 'V/A',
     'https://bandcamp.com/EmbeddedPlayer/album=3638334684/size=large/bgcol=333333/linkcol=9a64ff/transparent=true/', 654, 14, false),

    -- SOUNDCLOUD — original three players + newest sessions/premieres
    ('soundcloud', 'Specials 001', 'I-AM',
     'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2238731435&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 1, true),
    ('soundcloud', 'Collection', 'VA II',
     'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2108674447&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 2, true),
    ('soundcloud', 'Specials 002', 'L0L4 Hartz',
     'https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A2237925419&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 3, true),
    ('soundcloud', 'Podcast Sessions', 'Tepé',
     'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnoidcol%2Fno-id-podcast-sessions-tepe&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 4, true),
    ('soundcloud', 'Premiere', 'Corsac — Ignis',
     'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnoidcol%2Fcorsac-ignis-oneiromancer&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 5, true),
    ('soundcloud', 'Podcast Sessions', 'Diluet',
     'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnoidcol%2Fno-id-podcast-sessions-diluet&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 6, true),
    ('soundcloud', 'Podcast Sessions', 'Alex Cordova',
     'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnoidcol%2Fno-id-podcast-sessions-alex&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 7, false),
    ('soundcloud', 'Podcast Sessions', 'Dave L',
     'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnoidcol%2Fno-id-podcast-sessions-dave-l&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 8, false),
    ('soundcloud', 'Premiere', '9 8 r p m',
     'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fnoidcol%2F9-8-r-p-m-keep-it-simple-art&color=%23171616&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true', 280, 9, false)
) as v(platform, title, meta, embed_url, height, position, active)
where not exists (select 1 from public.media_embeds);
