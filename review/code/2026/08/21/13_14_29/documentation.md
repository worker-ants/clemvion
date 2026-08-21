# 문서화(Documentation) 리뷰 — masked-marker-contract-7d2e14 (라운드 5, 13_14_29)

## 검토 방법

이번 diff(95개 변경 파일)의 대다수(파일 24~94)는 이전 4개 코드 리뷰 라운드(`11_27_29`,
`11_53_49`, `12_25_15`, `12_50_37`)와 2개 consistency-check 라운드(`10_45_52`, `10_58_25`)의
산출물 자체다. 매 라운드 문서화 리뷰어가 독립적으로 검토했고(각각 NONE·LOW·NONE·LOW), 지적된
WARNING(plan 체크박스 stale, spec R17 미갱신, `SOT_DIR` 접두-겹침 하드닝의 backend/frontend
비대칭)은 모두 다음 라운드 커밋에서 실제로 반영됐음을 이번에도 원본 파일을 직접 `Read`로
재확인했다(중복 재기재 생략). 이번 라운드는 그 위에서 **아직 아무도 짚지 않은 각도**를 찾는
데 집중했다:

- `codebase/{backend,frontend}/src/{repo-guards,lib/repo-guards}/__tests__/masked-marker-mirror-guard.ts`
  전문 재확인 (`12_50_37` W1 수정 후 실제 코드)
- `codebase/{backend,frontend}/.../masked-marker-mirror.{spec,test}.ts` 헤더 JSDoc 전문 재확인
- `plan/in-progress/masked-marker-shared-package.md` 체크리스트·후속·Rationale 전문 재확인
- `spec/5-system/14-external-interaction-api.md` R17 diff 직접 확인
- `.github/workflows/packages-checks.yml` matrix 실측(6개, 주석과 일치)

## 발견사항

- **[WARNING] "탐지 로직 중복은 구멍을 만들지 않는다"는 JSDoc 의 절대 서술이, 이 PR 자기
  역사 안에서 이미 두 차례 반증됐는데도 캐버트 없이 그대로 남아 있다**
  - 위치: 다음 네 곳에 **동일 문구**가 그대로 있다 — `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:11-12`,
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 헤더 주석(같은
    문구가 `masked-marker-mirror.test.ts` 헤더에도 반복), `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:29-30`.
    직접 인용: *"값의 미러와 달리 **탐지 로직의 중복은 구멍을 만들지 않는다**: 한 사본이 낡아도
    다른 사본이 같은 불변식을 자기 트리거에서 계속 지킨다."*
  - 상세: 이 절대 서술은 `11_27_29` 라운드에서 처음 등장한 설계 근거이고, 이후 **정확히 그
    문장이 서술하는 보장이 두 차례 깨졌다**는 것이 이 PR 자체의 리뷰 이력이다. (1) `12_25_15`
    라운드가 `SOT_DIR` 접두-겹침 경계를 "명시했다"고 처분했는데 실제로는 backend 사본에만
    반영되고 frontend 사본은 옛 무경계 형태로 남았다(`12_50_37` documentation.md·security.md·
    maintainability.md 세 리뷰어가 독립적으로 이를 지적). (2) `12_50_37` 라운드 자신의
    RESOLUTION.md("WARNING 1 — '고쳤다' 가 거짓이었다")도 이 사실을 인정하며 *"전제가 완전히
    틀린 건 아니다(각 사본이 자기 트리거에서 계속 동작했다) — 다만 **로직 결함은 동시에
    고쳐야 하고, 그것을 기계가 확인하지 않으면 한쪽만 고쳐진다**. 그 확인이 이제 캐너리로
    있다"*라고 스스로 한 발 물러난 정정된 이해를 남겼다. 그런데 이 정정된 이해(=탐지 로직
    중복이 안전하려면 **캐너리로 파생 일치를 강제해야만** 안전하다는 조건부 진실)는
    RESOLUTION.md(리뷰 산출물, `review/**`)에만 적혔을 뿐, 실제 소스의 JSDoc 헤더에는 반영되지
    않았다. 현재 코드에는 `12_50_37` W1/W3 캐너리(`[캐너리] SoT 와 접두가 겹치는 형제 패키지는
    탐지 대상이다`, `[캐너리] 함수 선언 형태의 재선언을 탐지한다`)가 실제로 추가돼 있어 **지금
    이 순간은** 그 조건이 충족돼 있지만, 헤더 문구 자체는 여전히 "당연히 안전하다"는 무조건
    서술이라 향후 세 번째 파생 지점(예: `resolveScanDirs`/`findRedeclaredSymbols` 에 새 분기가
    추가될 때)에서 같은 실수(한쪽 사본만 갱신)가 재발해도 "이 설계는 원래 안전하다고 문서에
    적혀 있다"는 잘못된 안도감을 준다. 이 프로젝트가 스스로 반복 기록해 온 실패 형태("문서한
    보장이 구현보다 넓으면 안 된다", "손으로 짠 primitive + 확신 주석이 반증되면 물러서라")와
    정확히 같은 모양이며, 이번엔 그 반증이 **같은 PR 안에서 두 번** 일어났다는 점에서 캐버트를
    남길 근거가 이례적으로 강하다.
  - 제안: 네 곳의 헤더 문구를 예컨대 *"탐지 로직의 중복은 값의 미러보다 안전하지만 **자동은
    아니다** — 두 사본이 실제로 같은 불변식을 지키는지는 별도 검증이 필요하고, 이 PR 자체가 그
    검증 부재로 두 차례 한쪽만 고쳐지는 사고를 냈다(`12_50_37` W1). 지금은 파생 지점마다 캐너리
    (접두-경계·함수 선언 등)로 그 일치를 강제한다 — **새 파생 분기를 추가할 때마다 양쪽에 대칭
    캐너리를 함께 추가해야 이 보장이 유지된다**"* 정도로 정정한다. 리뷰 산출물(RESOLUTION.md)에
    이미 있는 정정된 이해를 소스 코드로 옮기기만 하면 되므로 비용은 낮다.

## 재확인 — 새로 악화되지 않음

- `plan/in-progress/masked-marker-shared-package.md`: `## 작업` 체크리스트 전 항목이 실제
  실행 경로와 일치한다. `/ai-review` 항목만 `[ ]`로 남아 있는데, 이는 이번 라운드가 바로 그
  실행이므로 정상이다. `## 후속 (이 PR 밖)`의 backend 깊이 경계 테스트 항목도 여전히 정확하게
  추적돼 있다.
- `spec/5-system/14-external-interaction-api.md` R17: "SoT 는 공유 패키지
  `@workflow/masked-markers`" 로 정확히 갱신돼 있고, frontmatter `code:` 목록(:16)에
  `codebase/packages/masked-markers/src/index.ts` 가 있다. `sanitize-error-message.ts`/
  `masked-markers.ts` 를 "재export shim" 이라 정확히 서술한다 — stale 없음.
  참고: 재export 지점(backend `sanitize-error-message.ts` export 블록, frontend
  `masked-markers.ts`)의 개별 JSDoc 은 값 자체는 정확히 서술하고 있어 새로운 stale 은 없다
  (`11_27_29` documentation.md 가 이미 이 이중 JSDoc 구조를 INFO 로 기록·불요 판정한 상태
  그대로).
- `.github/workflows/packages-checks.yml` matrix: 실제로 `@workflow/masked-markers` 포함
  6개(`ai-end-reason`·`masked-markers`·`expression-engine`·`graph-warning-rules`·
  `node-summary`·`chat-channel-validation`)이고 헤더 주석 "6개를 전부 등록"과 일치한다.
- README(`codebase/packages/masked-markers/README.md`)와 `src/index.ts` JSDoc 은 값·근거·
  기각한 대안 서술이 서로 겹치되 어긋나지 않는다.
- `CHANGELOG.md` 미기재는 `12_25_15` 라운드가 `@workflow/ai-end-reason` 선례로 조치 불요
  판정한 것과 동일 근거로 이번에도 유효하다 — 재등재하지 않는다.

## 요약

5라운드째인 이 PR 은 문서화 완성도가 이례적으로 높고, 매 라운드 스스로 발견한 WARNING(plan
stale, spec R17, 접두-겹침 하드닝 비대칭)을 다음 커밋에서 정확히 반영해 온 이력이 실측으로
확인된다. 이번 라운드에서 새로 찾은 것은 코드 결함이 아니라 **주석의 과잉 확신**이다 — "탐지
로직의 중복은 구멍을 만들지 않는다"는 절대적 설계 근거 문장이 이 PR 자신의 리뷰 역사 안에서
이미 두 번 반증됐는데(각각 다른 라운드의 WARNING), 그 반증에서 얻은 정정된 이해("캐너리로
파생 일치를 강제해야만 안전하다")는 리뷰 산출물(RESOLUTION.md)에만 남고 소스 코드의 JSDoc
헤더 네 곳에는 반영되지 않았다. 지금 이 순간 코드 동작에는 영향이 없다(실제 안전장치인
캐너리는 이미 존재)는 점에서 차단 사유는 아니지만, 이 저장소가 반복해 겪어 온 "문서한 보장이
구현보다 넓다" 패턴의 재발이고, 향후 이 가드에 새 파생 분기가 추가될 때 같은 사고(한쪽 사본만
갱신)가 또 나더라도 헤더 문구가 "원래 안전하다"고 잘못 안심시킬 여지를 남긴다는 점에서
WARNING 으로 기록한다.

## 위험도

LOW
