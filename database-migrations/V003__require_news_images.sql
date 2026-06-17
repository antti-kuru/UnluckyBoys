update news
set cover_image_url = '/brand/banner.png'
where cover_image_url is null or cover_image_url = '';

alter table news
  alter column cover_image_url set default '/brand/banner.png',
  alter column cover_image_url set not null;
