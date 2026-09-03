update players
set active = 1,
    bio = 'Looking back on UB history, we have somehow been able to sign tremendous goalies one after another. Benuh_ was no exception, as he instantly showed he belonged in Elite during his debut Elite season in the burger jersey, ECL 12. Calm as you like in net and especially good at saving breakaways. UB could charge a player development fee from the success of Benuh_''s career. But now he is back. The brick wall himself.',
    sportsgamer_url = 'https://sportsgamer.gg/players/1088',
    updated_at = datetime('now')
where slug = 'ben-rinnet';


update players
set position = 'RD',
    updated_at = datetime('now')
where slug = 'antti-kuru';

update players
set active = 1,
    updated_at = datetime('now')
where slug = 'ilmari-toyryla';



