# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 결과 확보, 전문 인라인 authoritative 반영 완료. 5개 checker 산출 파일은 이미 디스크에 존재 확인됨, 별도 영속화 불필요)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, plan 트래커 동기화 누락 2건(WARNING)과 spec 문면(`details.field`)이 이번 구현의 실측보다 낡았다는 사실 1건(WARNING, 이미 developer 가 planner 후속으로 등재)이 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> Critical 이 없으므로 해당 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity (중복 통합, 최강 등급 채택) | `details.field` 실제 표현(값이 비어있지 않을 때 `chatChannel.<field>` 중첩 경로) vs spec 문면(flat 표기 `details.field='botTokenRef'` 또는 "미확정 — 후속 e2e 확인 대기") 불일치. 이번 PR 이 새로 작성한 실측 테스트가 이 불일치를 확정했다 | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` (`[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다`), `triggers.controller.ts`, `triggers.service.ts` `assertPatchCarriesNoSecrets` | `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1, `spec/2-navigation/2-trigger-list.md` L176·R-12(L333) | planner 턴에서 두 spec 문서의 `details.field` 서술을 실측값(값 존재 시 중첩 경로 / null·빈 문자열은 서비스 층 flat 이름)으로 갱신. developer 자신은 이 문장을 쓰지 않았으므로(§자기-반증형 소정정 조건 1 미충족) 직접 고칠 수 없음. `plan/in-progress/impl-chat-channel-patch-token.md` 에 이미 planner 후속으로 등재되어 있으니 push 전 게이트에서 누락되지 않도록 재확인 |
| 2 | plan_coherence | "검증 함수 분리" 후속 항목(생성/수정 검증 함수 미분리 시 D-1 이 생성 경로를 깬다는 경고)이 이번 구현에서 실제로 해소됐는데, sibling plan 에는 반영되지 않고 미체크 상태로 남아 있음 | `plan/in-progress/impl-chat-channel-patch-token.md` 체크리스트(`[x] 구현 — DTO(...) · 검증 경로 분리 · 쓰기 게이팅 ①②`), 실제 코드 `triggers.service.ts:636-687`(`assertChatChannelInputSafe` mode 오버로드 + `assertPatchCarriesNoSecrets` 신설) | `plan/in-progress/spec-draft-nullable-notation-followups.md:2152-2158` (여전히 `[ ]` 미체크, 해소 주석 없음 — 같은 문서의 인접 두 CRITICAL 항목은 이미 "✅ 2026-09-11 해소" 갱신됨) | `spec-draft-nullable-notation-followups.md:2152` 항목에도 동일 패턴("✅ 해소, 근거: `assertChatChannelInputSafe` mode 오버로드 + `assertPatchCarriesNoSecrets` 신설")으로 체크·주석 추가. developer 소유 plan 항목이라 이 PR 마무리 커밋 범위에서 직접 갱신 가능(spec 아님) |
| 3 | plan_coherence | "트래커 기존 항목에 이 실측을 덧붙인다"는 target plan 의 자체 서술이 실제로는 이행되지 않음 (`assertChatChannelInputSafe` 기존 3분기 도달 가능성 실측 결과가 sibling tracker 본문에 반영 안 됨) | `plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것" 표 3행 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2073-2079` (추측성 서술 "도달 가능성이 높다"만 남아 있음) | 실측 결론("전역 파이프가 먼저 거부하며 HTTP 응답에 나가는 것은 파이프의 중첩 경로다. 서비스 직접 호출 경로는 남아 있어 가드를 유지한다")을 해당 항목 본문에 추가하여 추측 문구를 확정 실측으로 교체 또는 병기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 신규 400 분기 2종(최초 chatChannel 설정을 PATCH 로 시도 / provider 전환 시도)이 spec 표에 아직 행으로 등재되지 않음. 방향은 R-12/CCH-AD-02 취지와 일치하나 HTTP 표면화 방식 자체는 문서화 안 됨 | `triggers.service.ts` `assertChatChannelAlreadySetUp`(`details.field='chatChannel'`/`'provider'`) vs `spec/5-system/15-chat-channel.md` §5.4.1 표, `spec/2-navigation/2-trigger-list.md` R-12 | `15-chat-channel.md` §5.4.1 표에 두 행(또는 각주) 추가, R-12 에 "PATCH 시도 시 400 VALIDATION_ERROR(details.field='provider')" cross-link |
| 2 | cross_spec | provider-issued inbound signing 저장 API 서술(`store()`) vs 실제 호출(`rotate()`) — 이번 PR 이전부터 있던 spec 쪽 drift 로, 이번 diff 가 새로 만든 문제는 아니나 같은 호출부가 확장되며 재노출됨 | `triggers.service.ts` `setupChatChannel` vs `spec/5-system/15-chat-channel.md` L200·201·373·390 등 9곳 | 이미 planner 후속으로 추적 중(위 WARNING #1과 같은 planner 턴에서 함께 처리 권장). 이번 PR 신규 결함 아니므로 비차단 |
| 3 | convention_compliance | `ChatChannelUpdateConfigDto` 클래스 JSDoc/`//` 주석 배치 순서가 기존 선례(`schedule-response.dto.ts`)와 반대(JSDoc 이 먼저, 내부 서사 `//` 가 나중). 단, 실측상 설치된 `@nestjs/swagger@11.4.5` 플러그인은 클래스 레벨 JSDoc 을 `description` 에 반영하지 않아 현재 기능적 위험은 낮음 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:349-377` | 순서를 선례에 맞춰 재배치 권장(긴급 아님). `spec/conventions/swagger.md` §3 표가 필드/클래스를 구분하는지에 대한 기존 미결 질문(`plan/in-progress/spec-draft-nullable-notation-followups.md` 등재)을 이번 실측과 함께 planner 턴에서 해소 |
| 4 | convention_compliance | `swagger.md:315` 인용이 2줄 드리프트 — 실제로는 317행 (내용 자체는 정확) | `chat-channel-config.dto.ts:365` | 급하지 않음. 다음에 건드릴 때 줄 번호 대신 절 이름(§3)으로 교체하면 드리프트 면역 |
| 5 | plan_coherence | "9곳" vs "7곳" 개수 표기 불일치 — 같은 세션이 작성한 두 plan 사이 오기, 실제 나열은 9곳으로 일치 | `impl-chat-channel-patch-token.md` (9곳) vs `spec-draft-nullable-notation-followups.md:2105` 제목(7곳) | 제목의 "7곳"을 "9곳"으로 정정(또는 본문 나열을 7개로 좁힌 근거 명시). 다음 planner 턴이 제목만 보고 착수 시 2곳 누락 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `details.field` 실측(중첩 경로) vs spec flat 표기 불일치(WARNING), 신규 400 분기 2종 spec 표 미등재(INFO), store/rotate 기존 drift 재확인(INFO) |
| rationale_continuity | NONE | R-CC-21 이 명시적으로 기각한 3갈래 대안(필드 무시·rotate 가드 봉합·telegram 전용 API 분리) 어느 것도 재도입 없음. R-CC-10/R-12 정합 확인 |
| convention_compliance | NONE | 명명·Swagger/DTO 문서화·secret-store 호출 패턴·i18n 동기화 전축 준수. JSDoc 순서·줄번호 인용은 INFO 수준 |
| plan_coherence | MEDIUM | sibling plan(`spec-draft-nullable-notation-followups.md`) 갱신 누락 2건(WARNING) — 해소된 방어적 리팩터·약속한 실측 반영 모두 미기록. 9/7 개수 오기(INFO) |
| naming_collision | NONE | 신규 식별자(클래스·필드·endpoint·ENV·파일 경로) 없음 — 8회 연속 독립 재검증에서 NONE 수렴 |

## 권장 조치사항
1. `plan/in-progress/spec-draft-nullable-notation-followups.md:2152` 항목에 "검증 함수 분리" 해소 확인 주석 추가 (developer 권한 내, 이 PR 마무리 커밋 범위) — WARNING #2
2. `plan/in-progress/spec-draft-nullable-notation-followups.md:2073` 항목 본문에 "전역 파이프가 먼저 거부, 서비스 직접 호출 경로는 남아 있어 가드 유지" 실측 결론 반영 — WARNING #3
3. planner 턴에서 `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 및 `spec/2-navigation/2-trigger-list.md` 의 `details.field` 표기를 실측값(중첩 경로)으로 갱신 + 신규 400 분기 2종(최초 설정/provider 전환) spec 표에 등재 — WARNING #1, INFO #1
4. `plan/in-progress/spec-draft-nullable-notation-followups.md:2105` 제목 "7곳"→"9곳" 정정 — INFO #5
5. (선택, 비긴급) `chat-channel-config.dto.ts` JSDoc/`//` 순서를 선례에 맞춰 재배치, `swagger.md:315` 인용을 §3 참조로 교체 — INFO #3, #4
