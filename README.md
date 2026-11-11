# 말랑 레이스 (MALANG RACE)

아이들을 위한 3D 장애물 달리기 게임이에요. 달리다가 만나는 퀴즈 관문을 풀면서 결승선까지 가요.

- 게임 주소: https://nyangpedia.github.io/malang-race/
- 가로 화면 전용 (휴대폰은 옆으로 돌려 주세요)

## 온라인 기능 (보호자 계정)

- 보호자 계정 가입 (동의 + 보호자 PIN 4자리), 아이 프로필은 닉네임만 저장
- 클라우드 저장, 전체/친구 랭킹 (점수는 서버가 다시 계산)
- 친구 코드 + 보호자 승인, 승인한 친구끼리만 들어오는 친구 방 (이모티콘만 사용)
- 보호자 화면: 놀이 기록, 친구 승인, 하루 놀이 시간, 이모티콘/친구 방 켜고 끄기, 계정 삭제

## 관리자 모드

`supabase/schema.sql` 을 실행한 뒤, SQL Editor에서 아래 한 줄의 이메일을 운영자의 보호자 계정 이메일로 바꿔 한 번 실행하세요.

```sql
insert into public.admins(user_id) select id from auth.users where email = '내이메일@example.com' on conflict do nothing;
```

그 계정으로 로그인하면 보호자 메뉴에 **🛠️ 관리자** 탭이 생겨요. 통계, 아이 찾기, 닉네임 바꾸기, 점수 지우기, 공지 올리기를 할 수 있어요.

## 폴더

| 위치 | 내용 |
| --- | --- |
| `index.html` | 빌드된 게임 (파일 하나로 동작) |
| `supabase/schema.sql` | Supabase SQL Editor에 붙여넣어 실행하는 데이터베이스 설정 |
| `game/` | 게임 소스 (`src/*.js`, `template.html`) |

## 다시 빌드하기

```bash
cd game
node build.js          # malang-race.html 생성
cp malang-race.html ../index.html
```

`game/online/config.json` 에는 Supabase 프로젝트 주소와 공개용(publishable) 키만 들어가요. 이 키는 공개되어도 되는 키이고, 데이터는 행 수준 보안(RLS)으로 보호돼요. `service_role` 키나 데이터베이스 비밀번호는 절대 여기에 넣지 마세요.
