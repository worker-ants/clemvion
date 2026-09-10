# 정식 규약 준수 검토 — chatChannel PATCH bot token 우회 spec draft

대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md` (planner `--spec` 턴)
비교 규약: `spec/conventions/**` + 참조되는 `spec/5-system/3-error-handling.md` · `spec/5-system/15-chat-channel.md` · `spec/2-navigation/2-trigger-list.md` (실제 파일, 번들 절단분 직접 확인)

## 발견사항

### [CRITICAL] Rationale 항목 번호 `R-CC-17` 이 이미 다른 결정에 쓰이고 있다 — 번호 충돌

- target 위치: `## 변경안 > C.` — *"`15-chat-channel.md` 신설 Rationale `R-CC-17` — 우회의 형태와 처방의 함정"*
- 위반 규약: `spec/5-system/15-chat-channel.md` 의 로컬 관례(`### R-CC-N. <제목>`, `## Rationale` 절, 692~720행) — 문서 구조 규약(CLAUDE.md §문서 구조: Overview/본문/Rationale 3섹션, 하위 항목 식별자 고유성은 그 구조가 성립하기 위한 전제)
- 상세: `15-chat-channel.md` 를 직접 확인하면 `### R-CC-17. \`render_form\` v1 임시 텍스트 fallback + presentation renderer shape 처리` 가 **이미 689행에 존재**한다. 이 항목은 사실 R-CC-16 §(c) (683행), R-CC-17 자기 본문 (693·704행) 등 **문서 내부에서 3곳 이상이 앵커로 교차 참조**한다(`#r-cc-17-render_form-v1-임시-텍스트-fallback--presentation-renderer-shape-처리`). 현재 문서의 최대 번호는 `R-CC-20`(720행)이다. 번호 14 는 `git log -S"R-CC-14"` 로 확인한 결과 과거 실존했던 항목(`R-CC-14. PR #300 정합 catch-up — CCH-AD-01 의 "impl pending" 문구 제거`, 커밋 `f4640ff2d`)이 `841d6cfb8`(*"의사결정 과정·시간·review/plan 참조 제거"*)에서 **의도적으로 철회**된 것이며, 그 뒤 재사용된 적이 없다 — 이 저장소가 번호를 "빈 자리니 채운다" 로 다루지 않고 **retire 후 영구 결번**으로 다룬다는 실제 선례다. 즉 draft 가 "신설" 이라 부르는 `R-CC-17` 은 (a) 이미 점유돼 있고 (b) 그 점유 항목이 다른 결정(`render_form` fallback)을 담고 있어, draft 대로 집행하면 같은 식별자 아래 서로 무관한 두 결정이 공존하게 된다. 이는 이 문서의 R-CC-N 식별자가 "결정을 유일하게 가리킨다" 는, 다른 절들이 실제로 의존하는 불변식을 깨는 형태다.
- 제안: 신설 항목 번호를 **`R-CC-21`**(현재 최대 20의 다음)로 정정한다. 14 는 의도적 결번이므로 재사용하지 않는다. `## 변경안 > C` 와 draft 본문 전체(제목·앵커 언급)에서 `R-CC-17` → `R-CC-21` 로 일괄 교체할 것.

### [WARNING] 형제 세 필드의 `details.field` 규약 이탈 — 방치 자체는 허용되나 "별 후속" 이 미등재 약속에 그친다

- target 위치: `## 결정 > D-1` 인용문 블록(*"형제 세 필드가 규약에서 이탈해 있다..."*)
- 위반 규약: 없음(직접 위반 아님) — 다만 `spec/conventions/error-codes.md §3`(historical-artifact 예외 레지스트리) 의 확립된 관례("규약을 벗어난 기존 항목은 **명시 등록**하고 사유를 남긴다")와 비교하면 이번 draft 의 처리는 등록 강도가 약하다
- 상세: draft 의 판정 자체는 규약 문면과 실측 양쪽으로 **정확하다**. `3-error-handling.md:270` 은 *"`details[].field` 는 중첩/배열 경로를 `nodes[3].type` 형식으로 유지한다"* 고 규정하고, 실제 `CustomValidationPipe.flattenErrors`(`codebase/backend/src/common/pipes/validation.pipe.ts:49-73`) 는 `@ValidateNested()` 자식 오류를 `parent.child` 로 재귀 결합하며, `trigger-dto-validation.spec.ts` 가 `ChatChannelConfigDto` 가 실제로 `chatChannel` 아래 nested 로 검증됨을 보여준다 — 따라서 새 필드가 `chatChannel.botToken` 형태로 나가는 것은 규약과 구현 양쪽에 부합하는 **올바른 판정**이다. 반대로 형제 세 필드(`botTokenRef`〔`15-chat-channel.md:376`〕· `inboundSigningPlaintext`/`inboundSigning`〔`390행`〕)는 서비스 가드(`assertChatChannelInputSafe`)가 리터럴 문자열을 던지는 방식이라 접두어 없는 flat 이름이며, 이는 실제로 `3-error-handling.md:270` 의 문면에서 벗어나 있다 — draft 의 관찰도 정확하다.
  다만 "새 항목만 규약을 따르고 형제는 별 후속으로 미룬다" 는 절차 자체는 이 저장소의 관행(예: `error-codes.md §2` — "완벽한 이름을 소급 강제하면 breaking rename 이 양산된다" · 같은 문서 §5 등급 B — 미발견 위험을 인수하고 별도로 등재) 과 방향이 같아 **허용된다**. 그러나 `error-codes.md §3` 처럼 **표에 명시 등록**하거나, `15-chat-channel.md:378` 이 이미 쓰고 있는 인라인 각주 패턴(*"2026-08-11 정정 — 이 자리에 ... 라 적혀 있었다"*) 과 달리, 이번 draft 는 이 이탈 사실을 **planner draft 산문에만** 적고 §5.4.1 표/본문에는 흔적을 남기지 않는다(변경안 A·B·D 어디에도 형제 필드 이탈에 대한 각주가 없다). "별 후속으로 등재한다" 는 이 draft 자신의 약속이지만 실제 `plan/` 항목이나 표 각주로 고정되지 않으면, 이 프로젝트가 반복적으로 겪은 "미룬 항목 유실" 패턴(예: 유사 사례들이 plan lifecycle 문서에 다수 기록됨)의 재발 후보가 된다.
- 제안: 변경안 A 또는 B 에 한 줄 각주를 추가해 "`botTokenRef`/`inboundSigningPlaintext`/`inboundSigning` 의 `details.field` 는 서비스 가드 리터럴이라 `3-error-handling.md:270` 의 중첩 표기와 다르다 — 정정은 별 후속(TBD)" 정도로 표에 고정하거나, 이번 planner 턴이 끝나며 실제 `plan/` 트래커 항목을 하나 등재해 "별 후속" 을 추적 가능한 산출물로 만들 것을 권한다. (규약 자체를 갱신하라는 뜻은 아니다 — 등록 강도를 높이라는 절차 제안.)

### [INFO] `3-error-handling.md:270` 원시 줄번호 인용 — 이 저장소의 지배적 spec 상호참조 스타일과 다르다

- target 위치: `## 결정 > D-1` 두 번째 문단 (*"[`3-error-handling.md:270`](../5-system/3-error-handling.md) 가..."*)
- 위반 규약: 명시적 규약 없음 — `spec/conventions/review-citations.md` 는 **리뷰 산출물(`review/**`) 세션 경로 인용**만 다루고(§3 표: `codebase/**`·`spec/**` 는 리뷰 인용에 대해서만 "적용"), 문서 간 일반 상호참조 형식(§/앵커 vs 줄번호)은 규율하지 않는다. 따라서 CRITICAL/WARNING 은 아니다.
- 상세: 이번 세션에서 확인한 `3-error-handling.md`·`15-chat-channel.md`·`2-trigger-list.md`·`error-codes.md`·`audit-actions.md` 등 수십 건의 상호참조는 예외 없이 `§N` 절 번호 + 마크다운 앵커(`#절-슬러그`) 형식을 쓴다(`[3-error-handling.md §1.3]`, `[EIA §R17]` 등). draft 의 `3-error-handling.md:270` 은 이 저장소에서 관찰한 유일한 "raw 줄번호" 인용이며, 대상 파일이 편집될 때(§ 재배치 없이 단순 삽입만으로도) 어긋날 수 있어 이 프로젝트가 스스로 겪은 교훈(줄번호 인용의 취약성)과도 결이 다르다.
- 제안: `[3-error-handling.md §2.1]`(해당 절은 "에러 응답 형식 > 2.1 기본 형식") 형태의 절 번호 인용으로 바꾸는 편이 이 저장소의 지배적 관례와 더 정합한다. 강제 사항은 아니다.

### 검토 결과 — 위반 없음으로 판정한 항목

- **에러 코드 어휘 (`VALIDATION_ERROR` + `details.field`)**: 규약 부합. `error-codes.md §1` 은 `VALIDATION_ERROR` 를 "시스템 전역 공용 코드"(prefix 없는 별개 범주)로 명시하고, `3-error-handling.md §2.1` 의 기본 형식(`code: VALIDATION_ERROR`, `details[].field`)과도 그대로 일치한다. 신규 판정(`present 면 400`)이 기존 `INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD` 류의 별개 레이어(§4.2)를 오용하지도 않는다 — 이건 DTO whitelist 레벨(§2.1)의 generic 위반이지 트리거 파라미터 검증(§4.2) 사유가 아니므로 `VALIDATION_ERROR` 선택이 맞다.
- **§5.4.1 표 형식**: 기존 표 헤더(`시점 | 메커니즘 | 비고`), 예외/주목 행의 굵게 표시 관례(§5.5 케이스 매트릭스에서 이미 쓰는 패턴과 동일) 모두 준수. 표 구조를 깨지 않는다.
- **D-2 의 구현 세부 수준(`secrets.rotate 를 호출하지 않는다`)**: planner 범위를 넘는 과잉 규정이 아니다. 같은 문서의 §5.4.1/§5.4.1.1 "메커니즘" 열이 이미 `setupChannel()`, `SecretResolver.store()`, `mergeExternalConfig` 등 함수/메서드 수준까지 정상적으로 명시하는 것이 이 `5-system/` 문서의 확립된 서술 granularity 다 — 내부 호출명 수준 서술은 이 문서 안에서는 선례에 부합한다. 또한 draft 는 내부 호출 서술과 관측 가능한 계약("저장된 토큰은 손대지 않는다")을 **함께** 적어 관측 계약 쪽도 누락하지 않았다. 다만 향후 리팩터로 `secrets.rotate` 가 이름을 바꾸면 이 문장이 거짓이 될 수 있으므로, 관측 계약 문구를 주 서술로 앞세우고 내부 호출명은 괄호/부연으로 두는 편이 더 견고하다 — 이는 규약 위반이 아니라 설계 견고성 제안(INFO 수준)이다.
- **문서 구조(3섹션)**: draft 자체(plan 문서)는 `## 결정 → ## 변경안 → ## Rationale` 구조라 사실상 CLAUDE.md 가 권장하는 Overview/본문/Rationale 흐름을 따른다. frontmatter 도 `plan-lifecycle.md` §4 스키마(`worktree`/`started`/`owner` 필수 3필드 + `spec_impact` 리스트)를 만족한다.
- **swagger/DTO 명명 규약**: 이번 draft 는 DTO 분리·컨트롤러 변경을 명시적으로 developer 턴으로 위임하고(스스로 "이 turn 에서 하지 않는 것" 목록에 명시) 새 DTO/데코레이터 이름을 규정하지 않으므로 `conventions/swagger.md` 의 적용 대상이 아니다.

## 요약

이 draft 의 핵심 보안 판단(D-1/D-2/D-3, 우회 형태 분석, "반증된 전제가 덮은 더 큰 결함" 서술)은 실측에 근거가 탄탄하고, 에러 코드·에러 응답 형식·표 서술 granularity 는 관련 정식 규약(`error-codes.md`, `3-error-handling.md`, 그리고 `15-chat-channel.md` 자체의 서술 방식)과 잘 정합한다. 그러나 **변경안 C 가 신설하겠다는 Rationale 번호 `R-CC-17` 은 이미 다른 결정(`render_form` v1 폴백)이 점유하고 있는 번호**이며, 이 저장소의 실제 이력(git-확인)은 결번(14)조차 재사용하지 않는 관례를 보여준다 — 이 draft 를 그대로 spec 에 반영하면 식별자 충돌이 그대로 커밋된다. 이 한 가지를 `R-CC-21` 로 정정하면 나머지는 별도 spec 갱신 없이 통과 가능한 수준이다. 형제 세 필드의 `details.field` 이탈을 "새 항목은 규약대로, 형제는 별 후속" 으로 처리하는 것은 이 저장소의 점진적 정합화 관행과 방향이 같아 허용되나, 그 "별 후속" 을 표 각주나 plan 트래커로 고정하지 않으면 유실 위험이 있다.

## 위험도

HIGH — CRITICAL 등급 발견(Rationale 번호 충돌)이 이 draft 가 그대로 `15-chat-channel.md` 에 반영될 경우 문서 내부 교차 참조 무결성을 실제로 깨뜨리는 형태이며, `--spec` 게이트가 정확히 이런 사례를 잡아내야 하는 지점이다. 다만 원인이 국소적이고(번호만 21로 교체하면 해소) 그 외 규약 준수는 전반적으로 양호하므로, 이 한 항목만 수정되면 위험도는 LOW 로 낮아진다.

STATUS: success
