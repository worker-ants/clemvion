# 문서화(Documentation) 리뷰 — swagger-decisions (사용자 결정 3건 집행)

## 발견사항

- **[WARNING]** 새로 추가한 "예외→지시 재정의" 문구가, 그 문구가 스스로 "근거"로 지목하는 미변경 Rationale 섹션과 용어가 충돌한다
  - 위치: `spec/conventions/swagger.md:271-277` (신설 콜아웃 "반드시 적는다 — 보안·정책 캐비엇")
  - 상세: 이번 diff 로 §3 본문 콜아웃이 "DTO 길이가 강제가 아니게 된 이상(위 표) **'예외' 라는 틀은 성립하지 않는다** — 없는 상한을 면제할 수는 없다. 그래서 **면제가 아니라 지시**로 뒤집는다" 라고 명시적으로 재정의한다. 그런데 바로 다음 줄(`swagger.md:286`, 이번 diff 밖·미변경)의 "근거" 링크가 가리키는 절 `### §3 보안·정책 캐비엇 예외 — 왜 길이 제한 밖인가, 그리고 왜 양방향인가`(`swagger.md:471`)는 이번 PR 에서 전혀 손대지 않아 제목·본문 모두 옛 "예외/제한" 프레이밍 그대로다 — `**왜 예외인가** (2026-08-17): ... 10~40자 안에 그 사실과 이유를 동시에 담을 수 없어서, **이 부류만 길이 제한 밖에 둔다**`(`swagger.md:473-475`). 방금 위에서 "예외 프레이밍은 더 이상 성립하지 않는다" 고 선언한 문서가, 자신이 근거로 인용하는 절에서는 여전히 그 프레이밍을 제목·본문으로 쓰고 있다 — 셀프 모순이다. 독자가 "근거" 링크를 따라가면 방금 읽은 재정의와 반대되는 서술을 만난다.
  - 제안: `### §3 보안·정책 캐비엇 예외 — ...` 섹션 제목·도입부에 "예외"→"반드시 적는다(지시)" 재정의를 반영하는 한 줄(예: "2026-08-23: 위 §3 이 비강제화되며 이 절도 '예외'가 아니라 '길이 논의 밖의 필수 서술'로 재정의됐다 — 아래 원문은 도입 시점(2026-08-17) 프레이밍이다")을 추가하거나, 최소한 신설 콜아웃에서 이 절로의 "근거" 링크 옆에 "용어는 위 표 기준(2026-08-23)으로 갱신됨" 각주를 단다.

- **[WARNING]** `spec/conventions/swagger.md` 신설 문장에 오타 — 저장소 관행과 다른 유니코드 가운뎃점을 섞어 씀
  - 위치: `spec/conventions/swagger.md:271`
  - 상세: `"(2026-08-17 규약화 · 2026-08-22 요청 필드까지 확장ㆍ"` — 같은 줄 안에서 앞의 두 구분점은 `·`(U+00B7, 이 문서 전체에서 25회 쓰이는 표준 구분자)인데 마지막 하나만 `ㆍ`(U+318D, 한글 채움 점)로 다르다. 이 문서 전체에서 `ㆍ` 는 이 자리 1건뿐이라 명백한 오타다(육안으로는 거의 구분 안 되지만 grep 대조로 확인됨). 렌더링 차이는 미미하나 `grep '·'` 로 이 줄을 찾으려는 후속 검색에서 누락된다.
  - 제안: `ㆍ` → `·` 로 통일.

- **[WARNING]** plan 문서(`swagger-decisions.md`) 자신의 ③ 서술이, 실제 반영된 결정(3축 강제/지향 구분)보다 좁다 — "엔드포인트 `description`" 축이 본문에서 빠짐
  - 위치: `plan/in-progress/swagger-decisions.md:41-54` (`## ③ 길이 규칙 — 실측이 "규칙 아님" 을 말한다` 섹션)
  - 상세: 이 섹션 본문은 "**강제는 정말 필요한 곳에만 남긴다** — 엔드포인트 `summary` 는 목록 UI 에서 잘리므로 길이가 기능적 제약이다. DTO `description` 은 그렇지 않다"(`:53-54`) 로 **두 축**(엔드포인트 summary / DTO description)만 언급한다. 그런데 §3 은 원래 **세 축**(엔드포인트 summary 10~20자·엔드포인트 description 50~150자·DTO description 10~40자)이 있고, 실제로 반영된 `spec/conventions/swagger.md`(및 이 diff 의 `spec-sync-external-interaction-api-gaps.md:1008-1010`)는 "강제(엔드포인트 summary·**description**) / 지향(DTO description)" 3-way 로 정확히 갈랐다. `swagger-decisions.md` 는 이 plan 이 완료되면 `plan/complete/` 로 옮겨져 결정의 역사적 기록으로 남는데, 그 기록 자체가 "세 번째 축(엔드포인트 description)이 어떻게 됐는지"를 말하지 않는다. 트래커(`spec-sync-external-interaction-api-gaps.md:924-926`)에는 바로 이 두 길이 기준(DTO description vs 엔드포인트 description)을 혼동한 선례가 이미 기록돼 있어(review/consistency 의 cross_spec 도 동일 위험을 WARNING 으로 지적함), 이 plan 문서만 단독으로 읽는 다음 사람이 같은 혼동을 반복할 실제 위험이 있다.
  - 제안: `## ③ 길이 규칙` 본문에 "엔드포인트 `description`(50~150자) 은 그대로 강제 유지" 한 문장을 추가해 3축 결정을 온전히 반영한다.

- **[INFO]** 결정 요약 표의 "성격" 열이 행마다 다른 의미를 담아 혼동을 줄 수 있다
  - 위치: `plan/in-progress/swagger-decisions.md:17-21`
  - 상세: 표 헤더는 "항목 | 결정 | 성격" 인데, ① 행의 "성격" 값은 `코드 무변경 — 결정 기록만`(변경의 **성질**을 서술)인 반면 ②·③ 행의 값은 각각 `developer`/`planner`(작업의 **담당자**를 서술)다. 같은 열에 "무엇이 바뀌는가"와 "누가 하는가"라는 서로 다른 범주가 섞여 있어, 표만 훑는 독자는 열 의미를 오독하기 쉽다. (별개로 convention_compliance 리뷰가 지적한 frontmatter `owner: developer` 대 ③의 "planner" 불일치도 같은 뿌리의 문제다.)
  - 제안: 열을 "성격"(변경 성질) 과 "담당"(owner)으로 분리하거나, 최소한 "성격" 값을 세 행 모두 같은 범주(예: 변경 성질)로 통일한다.

- **[INFO]** `deprecated: true` OpenAPI 표면 변경에 대한 `CHANGELOG.md` 기록이 없다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:66`(`deprecated: true`) / 저장소 루트 `CHANGELOG.md`
  - 상세: 이 저장소 `CHANGELOG.md` 는 "Unreleased" 섹션에 API 소비자에게 보이는 변화(런타임 동작 변경뿐 아니라 `GET /api/model-configs/:id/models` 의 Swagger `@ApiQuery enum` 사례처럼 스펙 준수 클라이언트에는 영향 없는 문서/검증 강화도)를 적극적으로 기록해 온 관행이 있다(`CHANGELOG.md:1224`). 이번 PR 이 추가하는 `deprecated: true`(OpenAPI 스키마 플래그)는 런타임 동작을 바꾸지 않지만, SDK 코드 생성기·OpenAPI diff 툴이 관측할 수 있는 공개 API 표면 변화이고, swagger.md 자신이 "동명이의가 시간이 지나며 저절로 해소된다"고 기대하는 대상이 바로 외부 소비자다. 항목 자체가 이번 CHANGELOG 최신 항목들과 같은 영역(`ExecuteWorkflowDto`/`execute` 엔드포인트)이라 누락이 눈에 띈다.
  - 제안: `CHANGELOG.md` 에 짧은 항목(예: "`ExecuteWorkflowDto.input` 이 OpenAPI 상 `deprecated: true` 로 표시된다 — 런타임 동작 무변경, `parameterValues` 사용 권장") 추가를 고려한다. 강제는 아니며, 정도는 낮음.

## 미검출(양호하게 처리된 항목)

- `execute-workflow.dto.ts` 의 신설 JSDoc(`deprecated` 사유 설명)은 왜 리네임 대신 `deprecated` 를 택했는지, 코드(`parameterValues ?? input.parameters` 취지)와의 관계를 정확하고 상세하게 설명한다. 실제 컨트롤러 코드(`workflows.controller.ts:303-310`)의 병합 로직과 의미상 일치함을 확인했다.
- `workflows-execute-body.spec.ts` 신규 테스트는 목적(결정 고정)·대조군 필요성(`parameterValues` 는 deprecated 가 아니어야 함)을 주석으로 명시하고, `swagger-decisions.md` 의 뮤테이션 검증(`deprecated: true` 제거 시 RED)과도 대응해 문서와 테스트가 일치한다.
- `spec/conventions/swagger.md` 신설 `### §3 DTO 길이는 왜 강제가 아닌가` 절은 (a) 실측치와 재실측 시점 차이(114/333 vs 116/335)를 명시적 각주로 설명하고, (b) 기존 유보 문구("별개 판단이라 여기서 건드리지 않는다")를 그대로 인용해 defer 해제를 명확히 하며, (c) `deprecated` 패턴을 §1 로 일반화하지 않는 이유(rule of three 미달)까지 남겨 — review/consistency 의 WARNING 1·3·4, INFO 1 을 사실상 모두 해소했다.
- 유저 가이드(`codebase/frontend/src/content/docs/02-nodes/triggers.mdx`)는 애초에 `parameterValues` 만 권장 예시로 쓰고 legacy `input` 봉투를 노출하지 않아 이번 deprecation 방향과 이미 정합적이다 — 별도 갱신 불요.
- 앵커 링크(`#3-dto-길이는-왜-강제가-아닌가`)를 헤더 슬러그와 직접 대조해 정확함을 확인했다.
- `execute-workflow.dto.ts` 의 `{@link ExecuteNodeDto.input}` 은 파일 내 미-import 상태지만, 이는 같은 파일의 기존 `{@link WorkflowsController.execute}`(역시 미-import)와 동일한 기존 관행이며 저장소에 TypeDoc 설정이 없어(툴 처리 대상 아님, 순수 개발자 가독용) 새로운 결함이 아니다.

## 요약
핵심 문서화 산출물(DTO JSDoc, 회귀 테스트 주석, `swagger.md` 신설 Rationale)은 근거·인용·대조군까지 갖춘 높은 완성도를 보이며, 사전 consistency-check 가 지적한 WARNING 대부분(§3 3축 구분·유보 해제·수치 각주·`deprecated` 일반화 보류)이 실제 반영본에서 이미 해소돼 있다. 다만 이 PR 자체가 만든 새 결함이 하나 있다 — §3 본문에서 "예외→지시" 로 재정의하면서, 그 재정의가 근거로 지목하는 미변경 Rationale 절은 여전히 옛 "예외" 프레이밍 그대로라 문서 내부에서 용어가 어긋난다. 그 외에는 오타 1건(다른 유니코드 가운뎃점), plan 문서 자체 서술이 실제 3축 결정보다 좁은 점, 표 열 의미 혼용, `deprecated` 플래그의 CHANGELOG 미기록 등 낮은 심각도의 완결성 보강 항목들이다. 어느 것도 병합을 막을 수준은 아니다.

## 위험도
LOW
