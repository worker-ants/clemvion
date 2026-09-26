# Rationale 연속성 검토 — forbidden-desc-codes (재실행)

## 컨텍스트

직전 라운드(`review/consistency/2026/09/26/11_12_24`)는 Critical 1 (BLOCK: YES) —
「현재 §5-4 문구가 data-flow 결정과 어긋난다」— 로 종료됐다. 그 뒤 planner 커밋
`f262a638e`(draft 반영) · `eb40cc802`(가드가 잡는 방향을 «빠진 코드» 로 좁힘)가
`spec/conventions/swagger.md` §5-4 체크리스트 항목과 `## Rationale` 을 고쳤다. 본 라운드는
그 수정 후 파일을 대상으로 재검토한다.

target 은 다음 4개 spec 의 scratch 사본(내용은 저장소 현재 파일과 동일) — `spec/conventions/swagger.md` ·
`spec/data-flow/12-workspace.md` · `spec/5-system/1-auth.md` · `spec/5-system/3-error-handling.md`(번들
절단, 실제 파일 직접 Read 로 보완) — 이며, 저장소의 실제 파일을 직접 Read 해 대조했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 은 없다. 아래는 확인 결과와 참고용 INFO 뿐이다.

- **[INFO]** 직전 Critical 은 해소됐음을 확인
  - target 위치: `spec/conventions/swagger.md` §5-4 "새 엔드포인트 체크리스트" 3번째 불릿, `## Rationale`
    "§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)"
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` "가드 거부의 오류 코드 (2026-09-25)"
    — 채택안 (나) "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`, 멤버의 역할 미달만 역할 코드"
  - 상세: 수정 전 §5-4 는 "`@Roles()` 가 있으면 요구 역할과 코드만" 이라 적어, 채택안(나)이 명시적으로
    요구하는 "비멤버도 `NOT_A_MEMBER`" 를 빠뜨렸다(기각된 대안 (가) 쪽 서술과 사실상 같아짐). 현재 텍스트는
    "`@Roles()` 가 있으면 … `NOT_A_MEMBER` 를 싣고 요구 중 가장 낮은 역할의 코드를 더한다"로 정정되어
    채택안(나)과 정확히 일치한다. `viewer` 요구는 코드가 하나(멤버십과 동일)라는 서술도
    `workspace-roles.ts` 의 `ROLE_REQUIRED.viewer === NOT_A_MEMBER` 및 data-flow Rationale 과 부합한다.
  - 제안: 없음(이미 정합). 재발 방지용으로만 기록.

- **[INFO]** "빠진 코드만 잡는다" 로의 방향 축소도 과거 자기 지적을 반영해 일관됨
  - target 위치: `spec/conventions/swagger.md` §5-4 마지막 문장(저장소 가드 `forbidden-response-codes` 서술)
  - 과거 결정 출처: 같은 plan `plan/in-progress/forbidden-desc-codes.md` "검토 경고 처리" 표, `--impl-prep 11_12_24 W1` 처분
    ("역할이 바뀌는 날 가드가 RED 를 낸다" 를 먼저 적었다가 가드 술어로 반증)
  - 상세: 커밋 `eb40cc802` 가 "가드가 이 짝을 강제한다"(양방향으로 읽히는 서술)를 "빠진 가드 코드만 잡는다 —
    남은 코드와 서비스 거부는 세지 않는다"로 좁혔다. 이는 결정 번복이 아니라 **같은 세션 안에서 과장을
    반증하고 즉시 정정한 사례**이며, 새 서술이 왜 좁아졌는지 Rationale·plan 처분 표 양쪽에 남아 있다.
  - 제안: 없음.

- **[INFO]** §3 길이 강제 표의 카테고리 공백은 은폐가 아니라 트래커로 추적 중
  - target 위치: `spec/conventions/swagger.md` §3 "길이 — 강제되는 것과 지향하는 것을 가른다" 표
    (엔드포인트 summary/description, DTO description 3행만 존재)
  - 과거 결정 출처: 없음(신규 관찰) — `plan/in-progress/forbidden-desc-codes.md` "검토 경고 처리" 표의
    `--impl-prep 11_12_24 W2`
  - 상세: `@ApiForbiddenResponse({ description })` 는 이 길이표의 세 범주(엔드포인트 summary/description,
    DTO description) 어디에도 명시적으로 속하지 않는데, 이번 변경으로 403 설명 문장이 두 코드를 보간하며
    길어진다. 이 갭은 이미 인지되어 "트래커 신규 등재(planner 소관 · 이 PR 범위 밖)"로 처분됐다 — 조용히
    묻힌 게 아니라 명시적으로 defer 됐다.
  - 제안: 처분대로 별도 plan 항목으로 트래커에 등재만 확인. 이번 PR 범위에서 추가 조치 불필요.

## 요약

이전 라운드가 지적한 Critical(§5-4 문구가 data-flow 채택안(나)과 어긋남)은 커밋 `f262a638e`·`eb40cc802` 로
해소됐고, 현재 `spec/conventions/swagger.md` §5-4 본문·`## Rationale` 은 `spec/data-flow/12-workspace.md`
"가드 거부의 오류 코드 (2026-09-25)" 채택안, `spec/5-system/3-error-handling.md` §1.2 에러 코드 카탈로그
(`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED`), `spec/5-system/2-api-convention.md` §5.3
의 "RolesGuard 거부는 전용 코드를 갖는다" 서술과 모두 정합한다. 신규 에러 코드를 만들지 않고 기존에 이미
등재된 코드를 문서화 대상으로 삼으므로 카탈로그 등재 의무·명명 규약(§UPPER_SNAKE_CASE)도 건드리지 않는다.
"기존 라우트까지 소급한다"는 §1-4/§3 의 "신규 변경 한정" 관행과 다른 방향이지만, Rationale 이 §2-4(광고한
성공 코드) 선례를 명시적으로 인용해 그 이유(광고-실제 불일치는 이미 배포된 라우트에서도 클라이언트를
오도한다)를 밝혔으므로 "무근거 번복"이 아니라 정당화된 예외다. 남은 유일한 갭(§3 길이표에 응답 데코레이터
`description` 범주 부재)은 은폐되지 않고 트래커로 명시 이관됐다. 기각된 대안 재도입, 원칙 위반, 무근거
번복, invariant 우회 중 어느 것도 발견하지 못했다.

## 위험도
NONE
