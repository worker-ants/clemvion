# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `spec/conventions/swagger.md §5-4` 인용이 실제 조항보다 넓다 — "두 축을 요구하는 한 조항" 이라는 서술이 문서에 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:27-37`(파일 헤더 docstring), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:90` , `codebase/backend/src/modules/triggers/triggers.controller.ts:287-289`(신규 인라인 주석), `codebase/backend/src/modules/auth/auth.controller.ts:433-435`(신규 인라인 주석)
  - 상세: 네 곳 모두 "`spec/conventions/swagger.md` §5-4 의 한 조항이 (1) `@Param('id', ParseUUIDPipe)` 런타임 축과 (2) `@ApiParam({format:'uuid'})` 문서 축, 두 가지를 요구한다" 는 취지로 적는다. 그런데 실제로 `spec/conventions/swagger.md` §5-4("새 엔드포인트 체크리스트")를 열어 보면 해당 조항은 `- [ ] 경로 UUID 파라미터는 \`@ApiParam({ format: 'uuid' })\` 일관 적용` 한 줄뿐이고, 전체 문서 어디에도 `ParseUUIDPipe` 라는 단어가 없다(`grep -n "ParseUUIDPipe" spec/conventions/swagger.md` 0건). 오히려 같은 문서 §2-3 의 예시 코드는 `async findOne(@Param('id') id: string) { ... }` 로 **파이프 없이** 작성돼 있어, 이번에 baseline 0 으로 고정한 신규 가드(`param-uuid-pipe-guard.ts`)의 요구와 정면으로 어긋난다. 즉 "spec 이 이미 두 축을 규정하고 있다"는 네 곳의 주석은 spec 의 실제 서술 범위보다 넓게 말하고 있고, 이 문서만 읽고 새 엔드포인트를 작성하는 다음 사람은 §2-3 예시를 그대로 따라 썼다가 신규 가드에 걸리게 된다.
  - 제안: `spec/conventions/swagger.md` §5-4 체크리스트에 `@Param('id', ParseUUIDPipe)` 항목을 명시로 추가하고 §2-3 예시 코드에도 파이프를 붙이는 것을 followup 으로 등재(developer 는 spec/ 직접 수정 권한이 좁으므로 project-planner 턴 필요 — CLAUDE.md 자기-반증형 소정정 5조건에도 해당하지 않음: 이 문장은 developer 가 쓴 예고 문장이 아니라 기존 spec 원문이다). 최소한 네 주석의 표현을 "spec 이 요구한다"에서 "이 저장소의 실측 관례(135/136)를 가드로 승격했다 — swagger.md §5-4 는 아직 문서 축만 명시한다" 로 좁혀 스코프 과장을 없앨 수 있다.

- **[WARNING]** 사용자 관측 가능한 상태 코드 변경(`rotateBotToken` 비-UUID `:id`: 500 → 400)에 대한 CHANGELOG 항목 없음
  - 위치: `CHANGELOG.md` (변경 안 됨) / 관련 코드: `codebase/backend/src/modules/triggers/triggers.controller.ts:291`
  - 상세: 이 PR 은 `rotateBotToken` 에 `ParseUUIDPipe` 를 붙여 비-UUID `:id` 요청의 응답을 `500 INTERNAL_ERROR`(마스킹)에서 `400 VALIDATION_ERROR` 로 바꾼다 — API 소비자가 관측하는 실제 응답 코드가 달라지는 변경이다. 이 저장소의 `CHANGELOG.md` 는 바로 이런 종류의 변경(예: 같은 엔드포인트의 `502` 도입, 상태 코드 재분류)을 `## Unreleased` 항목으로 상세히 기록하는 확립된 관례를 갖고 있다(`CHANGELOG.md` 최상단 항목 "`rotateBotToken` 실패가 `502` 를 처음 쓴다" 참조). 그런데 이번 diff 15개 파일 중 `CHANGELOG.md` 는 포함되어 있지 않다. 드물게 걸리는 엣지케이스이긴 하나(비-UUID 를 실제로 보내는 클라이언트가 있었다면 이미 500 을 받고 있었을 것), "선언과 실제가 어긋난 자리" 를 대외에 알리는 관례가 이미 존재하는데 이번 건만 빠졌다.
  - 제안: 기존 항목 형식(변경 전/후 표 + "⚠️ 배포 시 확인")을 따라 `CHANGELOG.md` 에 한 항목 추가.

## 요약

핵심 기능 diff(가드 로직, 컨트롤러 데코레이터, MDX 안내 문구, `backend-labels.ts`/테스트 주석 정정) 자체의 문서화 밀도는 이 저장소 평균보다 높다 — 새 가드 파일(`param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`)은 실측 수치·근거 사슬·기각한 대안까지 docstring 에 남기고, `backend-labels.ts`/MDX 의 정정 주석도 원인(`hooks.service.ts` vs `triggers.controller.ts` 귀속 오류)을 정확히 짚었으며 코드로 직접 대조해 사실관계 오류를 찾지 못했다. 다만 신규로 도입한 "두 축 계약"을 정당화하며 반복 인용하는 `spec/conventions/swagger.md §5-4` 가 실제로는 그 절반(문서 축)만 규정하고 있어 spec 인용이 구현(가드)보다 좁게 실재하는데 주석은 넓게 서술하는 상태이고, 관측 가능한 상태 코드 변경에 대한 CHANGELOG 갱신이 이 저장소의 자체 관례 대비 누락되어 있다. 둘 다 기능적 결함은 아니며 후속 스윕으로 닫을 수 있는 수준이다.

## 위험도

LOW
