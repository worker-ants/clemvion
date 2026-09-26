# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-swagger-http-status-guard.md`

## 검토 대상

- target: `plan/in-progress/spec-draft-swagger-http-status-guard.md` (spec draft, `--spec` 검토 모드)
- 실제 반영 대상: `spec/conventions/swagger.md` — frontmatter `code:` 4줄 추가, §2-4 신규 문단, §5-4 체크리스트 1줄, `## Rationale` 신규 절
- 대조: `spec/conventions/spec-impl-evidence.md`(번들 전문), `spec/conventions/swagger.md`(파일시스템에서 전문 추가 확인), 병행 구현 plan `plan/in-progress/post-status-openapi.md`

## 발견사항

- **[WARNING] §5-4 체크리스트의 예시 목록이 병행 구현 plan 의 실측 인벤토리보다 좁다**
  - target 위치: "변경 (3) — §5-4 체크리스트" — `"광고한 성공 코드(`ApiOk*` 200 · `ApiCreated*` 201 · `ApiNoContent*` 204 …)"`
  - 위반 규약: `spec/conventions/swagger.md` §5-2(공용 래퍼 헬퍼 표 — `ApiAcceptedWrappedResponse` 가 202 Accepted 를 위한 정식 헬퍼로 이미 등재돼 있음) / 같은 draft 의 "변경 (4)" Rationale 자신이 세운 원칙("이름 → 코드 표를 손으로 쓰지 않는다" — 손으로 쓴 표는 지금 쓰는 이름만 담아 새 이름이 조용히 대조에서 빠진다)
  - 상세: 같은 구현을 다루는 `plan/in-progress/post-status-openapi.md` 의 실측 절은 "광고 = 성공(2xx) 응답 데코레이터의 상태 집합 (`ApiOk*` 200 · `ApiCreated*` 201 · **`ApiAccepted*` 202** · `ApiNoContent*` 204 · **`ApiResponse({ status: 2xx })`**)" 라고 다섯 갈래를 명시한다. 반면 이 draft 가 swagger.md §5-4 에 넣으려는 체크리스트 문구는 세 갈래(`ApiOk*`·`ApiCreated*`·`ApiNoContent*`)만 나열하고 `…` 로 얼버무린다. `ApiAcceptedWrappedResponse`(202)는 §5-2 표에 이미 존재하는 정식 헬퍼이므로 "드문 예외"가 아니라 이 저장소가 실제로 쓰는 성공 응답 갈래다. 체크리스트는 "새 엔드포인트 작성자의 판단 기준"(같은 문서 §5-4 확장 배경 Rationale)이라, 202 를 광고하는 엔드포인트 작성자가 이 규칙이 자신에게도 적용되는지 문면만으로 판단하기 어렵다. `…` 표기로 완전히 틀린 것은 아니지만, 같은 작업이 만든 자매 문서가 이미 정확한 5갈래 인벤토리를 갖고 있는데 spec 쪽 문면만 더 좁게 예시를 든 것은 "이름→코드 표를 손으로 쓰지 않는다"는 draft 자신의 경계 논리와 결이 어긋난다.
  - 제안: 체크리스트 예시에 `ApiAccepted* 202` 를 추가하거나(자매 plan 과 동일 인벤토리로 맞춤), 아니면 예시를 아예 들지 않고 "§2-4 표의 모든 2xx 데코레이터"처럼 표 전체를 가리키는 문구로 바꿔 특정 이름 나열 자체를 없앤다.

- **[INFO] 신설 가드명 `http-status-advertised` 의 어미가 기존 가드 명명 패턴과 결이 다르다**
  - target 위치: "변경 (1) — frontmatter `code:`" 및 "변경 (2)" 본문의 `가드 `http-status-advertised``
  - 위반 규약: 코드화된 규칙 없음 — `spec/conventions/**` 에 저장소 가드 이름 형식을 규정한 정식 조항은 발견되지 않음(참고용 관찰)
  - 상세: swagger.md 가 이미 `code:` 에 등재한 형제 가드들은 전부 명사형 어미다 — `swagger-dto-contract`(contract) · `dto-class-name-collision`(collision) · `user-entity-exposure`(exposure) · `param-uuid-pipe`(pipe). 신설 `http-status-advertised` 는 `advertised` 라는 과거분사(형용사)로 끝나 어미 품사가 다르다. 정식 규약 위반은 아니지만(그런 규칙 자체가 없음), grep 시 "가드 이름 = 명사"라는 암묵 패턴이 깨진다.
  - 제안: 굳이 바꿀 필요는 없음(규약 부재) — 다만 다음에 가드 명명 규칙을 성문화한다면 이 사례를 참고 표본으로 남길 것.

## 정합성 확인된 항목 (참고 — 위반 아님)

- `code:` 삽입 위치·형식(주석 + 대상 glob 2줄)은 `param-uuid-pipe` 항목과 동형이며, glob(`http-status-advertised*.ts`)은 구현 plan(`post-status-openapi.md`)이 예고한 실제 파일명(`http-status-advertised-guard.ts`/`http-status-advertised.spec.ts`) 둘 다와 매치된다.
- `spec-code-paths.test.ts` 는 "code: 배열 중 ≥1 개가 실재 파일에 매치"만 요구(개별 entry 매치 아님) — 아직 생성되지 않은 신규 glob 을 미리 frontmatter 에 넣어도 기존 매치 entry 들 덕에 build 가 깨지지 않는다. CRITICAL 아님.
- §5-4 체크리스트 항목의 `([§2-4](#2-4-상태-코드-응답-규칙))` 앵커는 GitHub slug 규칙(마침표 제거, 공백→하이픈, 기존 문서의 다른 앵커 예시들과 동일 패턴)과 정확히 일치한다.
- `@ApiExcludeEndpoint()` 예외는 `param-uuid-pipe-guard.ts` 가 이미 쓰는 "이름 목록이 아니라 구조로 예외를 둔다" 패턴의 재사용이다 — 신규 발명이 아니라 선례 재적용.
- "`@nestjs/swagger` 는 2xx 데코레이터만 일곱을 내보낸다(203·205·206 포함)"는 진술은 `node_modules/@nestjs/swagger` 실물 export(ApiOkResponse/ApiCreatedResponse/ApiAcceptedResponse/ApiNonAuthoritativeInformationResponse/ApiNoContentResponse/ApiResetContentResponse/ApiPartialContentResponse = 7개)와 정확히 일치 — 근거 문장 정확.
- Rationale 신규 절의 제목 형식(`### §2-4 ... — 왜 가드로 세는가 (2026-09-26)`)은 기존 `### §5-4 확장 배경 — ... (2026-08-08)` 등과 동일 스타일이며, `## Rationale` 절 끝에 append 하는 삽입 위치도 기존 append-only 관행과 일치.
- plan frontmatter(`title`/`status: in-progress`/`owner: project-planner`/`worktree`/`spec_impact`(리스트, 실재 경로 1개)/`started`)는 plan-lifecycle·spec-impl-evidence 두 규약이 요구하는 필드를 모두 충족.
- `repo-guards` 디렉토리에는 별도 중앙 레지스트리 파일이 없고(test runner 의 glob 자동탐색), PROJECT.md `자동 가드` 표에도 형제 가드(param-uuid-pipe 등)가 등재돼 있지 않다 — 신설 가드가 PROJECT.md 갱신을 언급하지 않은 것은 갭이 아니라 선례와 일치.

## 요약

target spec draft 는 기존 `swagger.md` 의 삽입 위치·주석 스타일·앵커 규칙·가드 명명 관례·frontmatter `code:` glob 패턴을 정확히 재사용하고 있고, 구조적으로 정식 규약을 위반하는 지점은 발견되지 않았다. 유일하게 눈에 띄는 것은 §5-4 체크리스트의 예시 데코레이터 목록이 같은 작업의 구현 plan(`post-status-openapi.md`)이 이미 확정한 5갈래 인벤토리(`ApiOk*`·`ApiCreated*`·`ApiAccepted*`·`ApiNoContent*`·`ApiResponse({status:2xx})`) 중 `ApiAccepted*` 와 generic `ApiResponse` 를 빠뜨린 채 3갈래만 예시로 든 것인데, `…` 로 비완전함을 표시해 두었으니 기능적 결함이라기보다 이 draft 자신이 세운 "이름→코드 표를 손으로 쓰지 말라"는 원칙과의 문면 정합성 문제다. CRITICAL 급 위반은 없다.

## 위험도

LOW
