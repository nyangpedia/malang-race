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

## 브랜드 행사 버전 (데모)

로고·색·문제를 파일 하나로 바꿔서 행사용 버전을 만들어요. 서버 없이 기기 하나(태블릿, 노트북)에서 돌아가고, 참가자가 차례로 하는 부스용이에요.

- 흐름: 브랜드 첫 화면 → 닉네임·색 고르기 → 브랜드 문제로 레이스 1판 → 점수, 선물(쿠폰 코드), 이 기기 TOP 10 → **다음 참가자**
- 순위는 그 기기에만 저장돼요. 주소 끝에 `?reset=1` 을 붙여 열면 순위가 지워져요.
- 데모: `demo/cafe.html` (카페 쿠폰), `demo/security.html` (사내 정보보안 교육, 상위 3명 기념품), `demo/eco.html` (환경 축제 부스)

새 브랜드 만들기:

```bash
cd game
cp brands/cafe.json brands/새브랜드.json   # id, 이름, 색, 문제 고치기
node build.js --brand brands/새브랜드.json # ../demo/<id>.html 생성
```

| 항목 | 뜻 |
| --- | --- |
| `id` | 파일 이름 (영어 소문자, 숫자, -) |
| `name`, `title`, `tagline` | 브랜드 이름, 첫 화면 제목, 한 줄 소개 |
| `logo` 또는 `logoText` | 로고 이미지 파일 경로(png/jpg/svg, html 안에 들어가요) 또는 두 줄 글자 로고 |
| `colors` | `main`(버튼·코스 바닥), `sub`, `accent`, `ink`(글자), `bg1`·`bg2`(배경). `"floor": false` 면 코스 색은 그대로 |
| `world` | 코스 테마: candy, block, cloud, jungle, space, crystal |
| `racers`, `level` | 함께 달리는 말랑이 수(5~50), AI 난이도(1~6) |
| `reward` | `title`, `text`, `code`(쿠폰 코드), `topN`(이 순위 안에만 보여 주기, 없으면 모두) |
| `questions` | `q` 문제, `a` 정답, `wrong` 오답 **정확히 4개** (문이 5개). 보기는 14글자 이하, 문제는 8개 이상 |

빌드할 때 문제 수, 오답 개수, 중복, 보기 길이를 검사해서 틀리면 알려 줘요.
