# Consistency Check 통합 보고서

**BLOCK: NO** — 회수된 3개 checker 결과 중 Critical 없음. 단, 아래 "재시도 필요" 항목 확인 전까지는 완전한 clean 판정이 아님.

대상: `spec/7-channel-web-chat/1-widget-app.md` (--impl-done, diff-base=origin/main)
diff 범위: `codebase/channel-web-chat/src/lib/presentation.ts`/`.test.ts`, `widget/components/presentations.tsx`/`.test.tsx` — table 잘림 배너에 `totalCount`(잘리기 전 총 행 개수) 투영·노출.

## 전체 위험도
**LOW** — 회수된 3개 checker(cross_spec/rationale_continuity/convention_compliance) 는 Critical 없이 WARNING 1건(i18n 스코프 공백)·INFO 1건(상태 라이프사이클 해석)만 보고. 단 **plan_coherence·naming_collision 2개 checker 는 `status=success` 로 보고됐으나 결과 파일이 디스크에 실존하지 않아(disk-write gap) 미회수** — 완전성 미확보.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 위젯 UI 신규 하드코딩 한국어 문자열(`총 N개 중 일부만 표시돼요.`, `일부 행만 표시돼요.`)이 `i18n-userguide.md` Principle 1(dict 키 경유 의무)의 스코프 대상인지 규약 문서상 불명확. 동시에 SDK 공개 계약(`2-sdk.md §4 BootConfig.locale: 'ko'\|'en'`)이 실제로는 위젯 UI 문자열 선택에 전혀 관여하지 않는 gap 을 이번 diff 가 target spec R8 본문에 정식으로 박제 | `spec/7-channel-web-chat/1-widget-app.md` §2 표, `## Rationale` R8 | `spec/conventions/i18n-userguide.md` Principle 1/6, `spec/7-channel-web-chat/2-sdk.md §4` | (a) i18n-userguide.md 에 `channel-web-chat` 제외 각주 명문화, (b) `_product-overview.md §2 비목표` 에 "위젯 UI 다국어화(EN) 는 v1 비목표, locale 은 [실제 용도]만 제어" 명문화, 또는 (c) 위젯도 dict indirection 채택. diff 자체 되돌림은 불필요(기존 로컬 패턴 답습일 뿐, 이번 diff 가 최초 위반은 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `status: implemented` 유지 상태에서 신규 "carousel 잘림 배너 미구현" 캐비어트 추가 — `spec-impl-evidence.md §3` 상태 라이프사이클과의 엄밀한 정합은 해석 여지(같은 문서 §2 헤더의 기존 동형 캐비어트 선례와 일관돼 조치 불요로 판단) | `spec/7-channel-web-chat/1-widget-app.md` frontmatter vs `## Rationale` R8 | 조치 불요. 규약에 "부가 기능 캐비어트는 implemented 유지 허용" 기준이 명문화되면 향후 판단 재현성 향상 |
| 2 | cross_spec | 메인 에디터 잘림 배너 문구(`truncated · total {N}`, 영문/약식) vs 위젯 문구(한국어 `총 N개 중 일부만 표시돼요.`) 글자 그대로 불일치 — 두 SPA 가 UI 코드 비공유·로케일/톤 상이하므로 cross-spec 모순 아님(behavior parity 는 유지) | `codebase/frontend` `assistant-presentations-block.tsx:316-320` vs `codebase/channel-web-chat` `presentations.tsx` | 조치 불요 |

## 재시도 필요 (disk-write gap)

| Checker | 보고 status | 근거 |
|---------|-------------|------|
| plan_coherence | success (보고값) | `output_file=.../plan_coherence.md` 가 세션 디렉토리에 존재하지 않음(`ls` 확인). `_prompts/plan_coherence.md` 는 존재(입력은 생성됨)하나 checker 산출물은 미기록. journal.jsonl 조회로도 텍스트 페이로드 복구 불가 |
| naming_collision | success (보고값) | 상동 — `output_file=.../naming_collision.md` 미존재, 산출물 미회수 |

두 checker 를 이 target(`spec/7-channel-web-chat/1-widget-app.md`, diff-base=origin/main)로 **재실행 후 본 SUMMARY 를 갱신**할 것을 권고. 회수된 3개 checker(cross_spec/rationale_continuity/convention_compliance) 만으로는 naming collision·plan 정합성 관점의 교차검증이 이루어지지 않았다.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 필드명(`rowsTotalCount`/`itemsTotalCount`)·§10.4 메타 동등성·carousel 제외 범위 모두 `4-nodes/3-ai/1-ai-agent.md §7.10`, `4-nodes/6-presentation/*` 와 일치. 데이터모델·API·상태전이·RBAC 충돌 대상 없음 |
| rationale_continuity | NONE | target R8 이 이미 사전에 "총 개수 흡수·노출" 을 명문화(커밋 `4e1f665fc` 선행) → 구현(`f72a08963`)이 후행. 기각된 대안 재도입·무근거 번복 없음. 방어적 파싱 스타일·해요체 전환도 기존 합의와 일치 |
| convention_compliance | LOW | WARNING 1건(i18n 스코프 공백, 이번 diff 가 원인은 아니고 기존 gap 을 spec 에 박제) + INFO 1건(상태 라이프사이클 해석, 조치 불요) |
| plan_coherence | 미회수 (재시도 필요) | disk-write gap — 산출물 파일 부재 |
| naming_collision | 미회수 (재시도 필요) | disk-write gap — 산출물 파일 부재 |

## 권장 조치사항
1. (BLOCK 해소 사유 아님, 회수 완전성 확보) `plan_coherence`·`naming_collision` checker 를 동일 target/diff-base 로 재실행하고 본 SUMMARY 를 갱신.
2. (WARNING) `spec/conventions/i18n-userguide.md` 의 스코프 선언에 `channel-web-chat` 포함 여부를 명문화 — (a) 제외 각주, (b) `_product-overview.md` 비목표 명문화, (c) dict indirection 채택 중 택1. 이번 diff 는 원인이 아니라 기존 gap 을 spec 에 정식 노출시켰을 뿐이므로 diff 자체의 되돌림은 불필요.
3. (INFO, 선택) `spec-impl-evidence.md §3` 에 "부가 기능(minor sub-feature) 캐비어트는 `implemented` 유지 허용" 기준을 명문화해 향후 유사 판단의 재현성을 높인다.