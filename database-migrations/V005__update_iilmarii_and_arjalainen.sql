update players
set name = 'Ilmari Töyrylä',
    bio = 'Originally the Unlucky Boys HC team was founded by Anhel_Kuru and iilmarii by playing 2s. Soon those games became boring and we found jm98II as the third piece of the original three. Before the first season, we had a little argue and iilmarii went to play ECL 4 to Nordic Stars. On ECL 5, iilmarii rejoined the team and showed his skills. After breakthrough season on ECL 5, the big teams catched their eye on him and SJK eEsports came to pick him up. iilmarii reached his full potential later in Symphony and JYP Esports. UB could charge a player development fee from the success of iilmarii''s career.',
    updated_at = datetime('now')
where slug = 'ilmari-toyryla';

update players
set image_url = '/brand/arjalainen.png',
    updated_at = datetime('now')
where slug = 'j-arjalainen';
