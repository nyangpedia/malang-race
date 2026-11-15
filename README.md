# 말랑 레이스 (MALANG RACE)

아이들을 위한 3D 장애물 달리기 게임이에요. 달리다가 만나는 퀴즈 관문을 풀면서 결승선까지 가요.

- 게임 주소: https://nyangpedia.github.io/malang-race/
- 가로 화면 전용 (휴대폰은 옆으로 돌려 주세요)

## 온라인 기능 (닉네임만으로 시작)

- 가입 창 없이 닉네임만 정하면 시작해요. 기기마다 익명 로그인을 쓰고, 서버에는 닉네임, 말랑이 모습, 게임 기록만 저장해요 (이메일, 실명, 생년월일, 전화번호 없음).
- Supabase 대시보드에서 **Authentication → Sign In / Providers → Allow anonymous sign-ins** 를 켜야 해요. 꺼져 있으면 기록은 그 기기에만 저장돼요.
- ⚙️ 설정의 **이어하기 코드**(8자리)로 다른 기기에서 같은 말랑이로 이어서 할 수 있어요.
- 클라우드 저장, 전체/친구 랭킹 (점수는 서버가 다시 계산)
- 친구 코드로 친구 추가, 받은 아이가 게임에서 수락. 방을 만들고 친구 목록의 **초대**를 누르면 친구 광장에 초대가 떠요 (이모티콘만 사용).
- 예전에 만든 이메일 계정과 운영자 계정은 "다른 기기에서 하던 기록 가져오기" 창의 이메일 로그인 링크로 들어가요.

## 관리자 모드

`supabase/schema.sql` 을 실행한 뒤, SQL Editor에서 아래 한 줄의 이메일을 운영자 이메일 계정으로 바꿔 한 번 실행하세요.

```sql
insert into public.admins(user_id) select id from auth.users where email = '내이메일@example.com' on conflict do nothing;
```

그 계정으로 로그인하면 광장 왼쪽 위에 **🛠️ 관리자 모드** 배지가 떠요. 누르고 PIN을 넣으면 통계, 아이 찾기, 닉네임 바꾸기, 점수 지우기, 공지 올리기를 할 수 있어요.

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
