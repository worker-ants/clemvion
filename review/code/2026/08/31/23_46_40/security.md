# 보안(Security) 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 총평 먼저

이 PR은 "공개 버킷 + 공개 URL" 이라는, 태생적으로 위험을 내포하는 설계를 선택하면서도 그
대가를 코드·문서·테스트 세 층위에서 일관되게 좁혀 놓았다:

- 키에 `randomUUID()` 를 넣어 공개 버킷에서 **키 자체를 접근 통제**로 쓴다 (열거 방지),
  두 번 업로드 시 키가 달라지는지까지 회귀 테스트로 고정.
- `Content-Type` 을 클라이언트 `mimetype` 이 아니라 **서버가 확장자에서 파생**시켜 강제한다
  — 저장형 XSS(악성 `text/html` Content-Type 저장)의 주 벡터를 막는다. SVG 는 스크립트를
  품을 수 있는 유일한 이미지 포맷이라 화이트리스트에서 의도적으로 제외했다.
- 확장자 조회를 `hasOwnProperty` 로 감싸 `constructor`/`__proto__` 를 통한 프로토타입 체인
  우회를 막는다(실측: 소문자화 후 실제로 뚫리는 이름은 2개뿐임을 뮤테이션으로 검증).
- MinIO `mc anonymous set download` 가 `s3:ListBucket` 을 함께 여는 것을 **실측으로 발견·
  기각**하고, `GetObject` 만 허용하는 명시적 JSON 정책(`scripts/minio/avatars-public-read.json`)
  으로 교체했다. 목록 조회가 열리면 "키의 UUID 추측 불가능성" 이라는 유일한 접근 통제가
  무의미해진다는 점을 정확히 짚었고, 정책 리소스도 `avatars/*` 접두로 스코프가 좁혀져 있어
  같은 버킷의 다른 prefix(워크플로 파일·KB 첨부 등)는 영향을 받지 않는다.
- `S3_PUBLIC_BASE_URL`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` 를 K8s ConfigMap/Secret 에 올바르게
  분리했다 — public base URL 은 비밀이 아니므로 ConfigMap, 자격증명은 그대로 Secret.
- 인증은 컨트롤러 클래스 레벨 `@UseGuards(JwtAuthGuard)` 로 걸리고, `updateAvatar` 는
  `payload.sub`(JWT subject)만으로 대상 사용자를 정하므로 다른 사용자의 아바타를 지정할 수
  없다(컨트롤러 테스트로 고정). 전역 `UserThrottlerGuard`(사용자당 분당 100회)가 이 엔드포인트
  에도 적용돼 개별 `@Throttle` 없이도 남용이 어느 정도 제한된다.
- 옛 아바타 정리(`deletePreviousAvatarObject`)는 대상 키를 `avatars/{userId}/` 접두로만
  앵커링해, `PATCH /users/me` 로 사용자가 임의 문자열을 `avatarUrl` 에 넣더라도 복원되는 키는
  항상 **자기 자신의 접두 아래**로 국한된다 — 남의 객체를 지울 수 없음을 테스트로 확인.
  S3 오브젝트 키는 파일시스템처럼 `..` 를 정규화하지 않는 flat namespace이므로, 크래프팅된
  `avatarUrl` 로 상위 경로 이탈을 시도해도 리터럴 키 불일치로 실패(no-op)한다.

아래는 이 설계 위에서 남는 잔여 리스크다. Critical 은 없다.

### 발견사항

- **[WARNING]** 업로드 파일의 실제 바이트가 유효한 이미지인지 검증하지 않는다(매직바이트/실제
  디코딩 검증 부재) — 확장자 화이트리스트 + 서버 강제 `Content-Type` 조합이 stored-XSS 주
  벡터(악성 콘텐츠가 `text/html` 로 해석되는 경로)는 확실히 막지만, "임의 바이너리에 `.png`
  확장자만 붙여 공개 버킷에 올리는 것"까지는 막지 않는다. `Content-Type: image/png` 로 응답되는
  한 브라우저가 그 바이트를 스크립트로 실행하지는 않으므로 XSS 리스크는 낮지만, 공개 URL 이
  임의 파일을 공개 배포하는 용도로 오·남용될 여지(스토리지 낭비·평판 리스크)는 남는다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar()` 의 확장자
    화이트리스트 판정 블록 (게이트 93~111줄, `const ext = file.originalname.split('.')...`
    부터 `if (!contentType) { throw ... }` 까지).
  - 제안: 필수는 아니지만, `sharp`/`file-type` 등으로 실제 이미지 매직바이트를 검증하는 방어를
    추가하면 이 잔여 표면을 닫을 수 있다. 지금 상태로도 XSS 는 막혀 있으므로 우선순위는 낮다.

- **[WARNING]** 동시 업로드 TOCTOU(리뷰 2라운드 W5, 이미 유예 결정됨)로 생기는 고아 객체가
  **스토리지 비용 관점의 남용 벡터**가 될 수 있다는 점을 재확인한다. 전역 rate limit(사용자당
  분당 100회) × 아바타 최대 2MB 를 곱하면, 인증된 단일 사용자가 짧은 시간에 최대 ~200MB/분
  상당의 고아 객체를 의도적으로 쌓을 수 있다(정리 로직이 "패자" 요청의 업로드 결과를 놓치므로).
  데이터 정합성·타 사용자 노출과는 무관하고, `plan/in-progress/spec-sync-user-profile-gaps.md`
  에 재개 신호(오브젝트 수가 사용자 수를 유의미하게 초과)까지 명시해 둔 것은 좋으나, 그 신호가
  **자동 알람이 아니라 수동 관측**이라는 점은 그대로 남는 잔여 리스크다.
  - 위치: `codebase/backend/src/modules/users/users.service.ts` — `updateAvatar()` 전체(게이트
    79~147줄) 및 `plan/in-progress/spec-sync-user-profile-gaps.md` 게이트 81~92줄(기존 유예
    기록, 새로 만든 문제 아님 — 재확인 목적으로 기재).
  - 제안: 이미 인지·유예된 항목이므로 이번 PR 을 막을 사유는 아니다. 다만 재개 신호를 주기적
    배치(예: `avatars/` 오브젝트 수 vs 사용자 수 비율을 정기 집계)로 자동화하면 "수동 관측에
    의존" 이라는 잔여 갭이 닫힌다.

- **[INFO]** 공개 아바타 오브젝트 응답에 `X-Content-Type-Options: nosniff` 가 설정되지 않는다.
  현재 주 방어(서버가 확장자로 `Content-Type` 을 강제)가 견고해 실질 위험은 낮지만, 일부
  레거시 브라우저 경로에서의 MIME 스니핑에 대한 추가 방어선으로 이 헤더를 `PutObjectCommand`
  에 실어 두는 것을 권장한다.
  - 위치: `codebase/backend/src/common/services/s3.service.ts` — `upload()` 메서드(전체 파일
    컨텍스트 게이트 53~67줄, 이 PR 이 손대지 않은 기존 코드).

- **[INFO]** `mc anonymous set-json` 은 버킷 정책을 **병합이 아니라 통째로 교체**한다. 지금은
  `createbuckets` 엔트리포인트에서 이 호출이 유일한 정책 적용이라 문제가 없지만, 앞으로 다른
  prefix 에 별도 공개 정책이 추가되고 그 적용이 이 호출 뒤에 온다면 아바타 정책이 조용히
  사라질 수 있다(반대 순서면 그쪽이 사라진다). 코드 결함은 아니고 향후 유지보수 시 주의할
  지점이다.
  - 위치: `docker-compose.yml` 게이트 75줄 / `docker-compose.e2e.yml` 게이트 96줄
    (`mc anonymous set-json /policy/avatars-public-read.json ...`).

- **[INFO]** `S3_PUBLIC_BASE_URL` 미설정 시 프로덕션에서도 `http://localhost:9000` 까지
  폴백되는 경로가 열려 있다. `main.ts` 가 production 에서 `isPrivateHost` 로 검사해 `warn` 을
  남기지만 `throw` 는 하지 않는다(기존 `ALLOW_PRIVATE_HOST_TARGETS` 패턴과 의도적으로 동일한
  설계). 결과적으로 오배포 시 전체 사용자의 `avatarUrl` 컬럼에 도달 불가능한 URL 이 조용히
  저장될 수 있다 — 다만 이는 정보 노출·인가 우회가 아니라 가용성(깨진 이미지) 문제이고, 이미
  CHANGELOG·k8s overlay 주석·`.env.example` 세 곳에서 반복 경고되고 있어 발견 가능성은 낮지
  않다.
  - 위치: `codebase/backend/src/main.ts` 게이트 159~172줄.

## 요약

핵심 위험 요소(공개 버킷에서의 키 열거, 클라이언트 제어 Content-Type 을 통한 저장형 XSS,
프로토타입 오염을 통한 화이트리스트 우회, MinIO `anonymous set download` 의 숨은
`ListBucket` 노출)를 모두 실측 기반으로 식별하고 코드·인프라·테스트 세 층위에서 정확히
막았다. 자기 접두 앵커링으로 아바타 정리 로직이 타 사용자 객체를 건드릴 수 없음도 확인했고,
K8s 상에서 공개 base URL(비밀 아님)과 자격증명(Secret)의 분리도 올바르다. 남는 항목은 모두
Critical 이 아니라 방어 심화(defense-in-depth) 또는 이미 알려진 채 의식적으로 유예된
스토리지 비용 리스크의 재확인 수준이며, 즉시 차단할 사유는 없다.

## 위험도

LOW
