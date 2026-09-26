# 정식 규약 준수 검토 — forbidden-desc-codes (`--impl-prep` 재실행)

## 검토 범위

번들된 target(`spec/conventions/swagger.md` · `spec/data-flow/12-workspace.md` · `spec/5-system/1-auth.md`,
`spec/5-system/3-error-handling.md` 는 컨텍스트 예산 초과로 생략)에 더해, 생략된 `3-error-handling.md` 는 "없다는
사실을 없다는 근거로 삼지 말라"는 지시에 따라 리포지토리에서 직접 Read 했다. 아울러 이번 작업의 실제 산출물인
`plan/in-progress/forbidden-desc-codes.md`(developer 구현 plan)를 대조해, 직전 `--impl-prep`(`11_12_24`)이 낸
CRITICAL 이 이후 커밋으로 실제 해소됐는지 재확인했다.

## 발견사항

- **[WARNING] §3 길이 규약 표가 응답 데코레이터(`@ApiForbiddenResponse`) `description` 을 여전히 분류하지 않는다**
  - target 위치: `spec/conventions/swagger.md` §3 "주석/설명 톤" — "강제되는 것과 지향하는 것을 가른다" 표
    (엔드포인트 `summary` / 엔드포인트 `description` / DTO `description` 세 갈래만 존재)
  - 위반 규약: 같은 문서 §3 자체 — 이 표가 스스로 "강제 vs 지향" 을 가르겠다고 선언했는데, `@ApiOkResponse`·
    `@ApiForbiddenResponse` 등 **응답 레벨 데코레이터의 `description`** 은 표의 세 범주 중 어디에도 안 든다
  - 상세: 이번 §5-4 개정이 만드는 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`)는 최대 두
    코드 문장을 이어 붙인 `@ApiForbiddenResponse({ description })` 을 129곳(+ 기존 28곳, 총 157곳)에 채우는
    작업이다 — 즉 이 spec 이 그대로 방아쇠를 당기는 문구가 정작 §3 의 길이 규율 밖에 있다. 직전
    `--impl-prep`(`11_12_24`)이 이미 이 갭을 WARNING 으로 지적했고, 이번 plan(`forbidden-desc-codes.md`
    "검토 경고 처리" 표 W2)은 "트래커 신규 등재(planner 소관 · 이 PR 범위 밖)" 로 처분한 뒤 자신의 "요구
    (순서대로)" 7단계에 "§3 길이 규약 항목 신규 등재" 를 넣어 뒀다 — 그런데 실측(`grep -rn "응답 데코레이터"
    plan/`)으로 확인한 결과 그 트래커 등재는 **아직 이뤄지지 않았고**, 체크리스트의 "트래커 항목 닫기" 도
    미체크 상태다. 즉 지금 시점의 swagger.md 는 여전히 답이 없는 채로 129~157개의 새 문구를 만들어 내는
    근거 문서다.
  - 제안: CRITICAL 은 아니다(§3 은 "지향" 범주가 대부분이라 강제 상한을 어기는 구조가 아니고, plan 이 이미
    7단계에서 스스로 닫기로 약속했다). 다만 이 PR 이 종결되기 전(plan 7단계) §3 표에 최소 각주 한 줄
    ("위 표는 `@ApiOperation`·DTO 필드 한정, `@ApiXxxResponse` 는 지향/무제한") 을 실제로 넣을 것을 재확인
    권고한다 — 지금처럼 "나중에 등재" 메모만 반복되면 §3 신설 취지("강제되는 것과 지향하는 것을 가른다")가
    빈 칸으로 계속 유예된다.

- **[INFO] 직전 `--impl-prep`(`11_12_24`) CRITICAL 은 해소를 확인했다**
  - target 위치: `spec/conventions/swagger.md` §5-4 새 엔드포인트 체크리스트 403 항목
  - 상세: 직전 라운드는 "`@Roles()` 가 있으면 요구 역할 코드만 광고" 문구가 data-flow §Rationale "가드
    거부의 오류 코드"(비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`)와 어긋난다고 CRITICAL 을 냈다. 현재
    target 은 "설명에는 **가드가 낼 수 있는 거부 코드를 전부** 싣는다 — 비멤버는 요구 역할과 무관하게
    `NOT_A_MEMBER` 이므로 대상 라우트는 모두 … 를 싣고, `@Roles()` 가 있으면 요구 중 가장 낮은 역할의
    코드를 더한다" 로 수정돼 있어(커밋 `f262a638e`), data-flow SoT 와 정확히 일치한다. 재-flag 하지 않는다.
  - 아울러 `e2528e68c`/`eb40cc802` 로 이어진 후속 정정("가드는 **빠진** 코드만 잡는다 — 역할을 내린 뒤 설명에
    남는 옛 역할 코드나 서비스 거부는 못 잡는다")도 §5-4 본문에 그대로 실려 있다 — 자동 검증이 실제로
    커버하는 방향(빠짐)과 못 커버하는 방향(남음)을 문서가 정확히 구분해 적어, "문서한 보장이 구현보다
    넓다" 는 유형의 결함을 만들지 않는다.

- **[INFO] 신규 guard 파일 경로가 아직 존재하지 않는 채로 `code:` frontmatter 에 먼저 등재됐다 — 규약 위반은 아님**
  - target 위치: `spec/conventions/swagger.md` frontmatter `code:` 마지막 줄
    (`codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts`)
  - 상세: `status: implemented` 문서의 `code:` 는 `spec-code-paths.test.ts` 가드로 "목록 전체에서 **최소
    1개** 글롭이 실 파일에 매치" 만 요구한다(엔트리별 개별 매치 의무 아님, `spec/conventions/
    spec-impl-evidence.md` §3). swagger.md 는 이미 다른 엔트리(`common/swagger/**` 등)로 그 조건을
    충족하므로, 아직 구현되지 않은 `forbidden-response-codes*.ts` 를 미리 등재해도 build 가드를 깨지
    않는다. plan 이 명시한 순서("spec draft → `--spec` → 반영 → `--impl-prep`" 가 코드 구현보다 먼저)와도
    합치한다 — 위반이 아니라는 점을 다음 세션의 재검토 비용을 줄이기 위해 명시해 둔다.

## 준수 확인 (검증했으나 위반 아님 — 참고용)

- 에러 코드 명명 — `NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED` 는 이미
  `spec/5-system/3-error-handling.md` §1 카탈로그에 UPPER_SNAKE_CASE 로 등재된 기존 코드이며,
  `spec/conventions/error-codes.md` §1(의미 기반 명명)·§2(rename 안정성) 어느 것도 우회하지 않는다 —
  이번 변경은 새 코드를 만들지 않고 기존 코드를 설명 문구에 노출할 뿐이다.
- `spec/data-flow/12-workspace.md` 는 frontmatter 가 없다 — `spec-impl-evidence.md` §1 이 `spec/data-flow/**`
  를 frontmatter 의무 대상에서 명시적으로 제외한 것과 일치(위반 아님).
- swagger.md 가 참조하는 앵커(`#가드-거부의-오류-코드-2026-09-25`,
  `#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08`, `#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25`)
  전부 `12-workspace.md` 의 실제 헤딩과 일치 — 링크 무결성 위반 없음.
- 신규 가드 파일명 규칙(`forbidden-response-codes{-guard.ts,.spec.ts}`)은 저장소 관례
  (`http-status-advertised-guard.ts`+`.spec.ts`, `param-uuid-pipe-guard.ts`+`.spec.ts`,
  `dto-class-name-collision-guard.ts`+`.spec.ts`)와 정확히 일치.
- 헬퍼 이름 `FORBIDDEN_NOT_A_MEMBER` 는 기존 컨트롤러 로컬 상수 관례(`workspaces` 의 `FORBIDDEN_*_ROUTE`,
  `integrations` 의 `FORBIDDEN_MEMBER`)를 공용 위치로 승격한 것으로, 그 로컬 관례를 정확히 계승한다.

## 요약

핵심 CRITICAL(§5-4 문구 ↔ data-flow SoT 불일치)은 이번 리뷰 시점에 커밋 `f262a638e`·`eb40cc802` 로 이미
해소돼 있음을 실측으로 확인했다. 남은 것은 §3 길이 규약이 이번 작업이 대량으로 찍어내는 응답 데코레이터
`description` 범주를 여전히 분류하지 않는다는 WARNING 뿐이며, 이는 이미 plan 자체가 "나중에 등재" 로
인지·예정하고 있으나 이번 검토 시점까지는 실행되지 않았다 — 이 PR 이 끝나기 전에(plan 7단계) 실제로 닫히는지
확인이 필요하다. 그 밖에 새 guard 경로의 조기 등재·헬퍼·에러 코드 명명은 모두 기존 규약·관례와 정합했다.

## 위험도

LOW — CRITICAL 없음. WARNING 1건은 이미 plan 이 인지하고 이 PR 종결 전 처리를 예정한 항목으로, 구현
착수를 막을 사유는 아니되 트래커 등재가 실제로 이뤄지는지는 `--impl-done` 단계에서 재확인해야 한다.
