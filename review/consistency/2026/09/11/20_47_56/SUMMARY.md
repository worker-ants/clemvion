# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. 전문 확보 못한 checker 없음(5/5 success + 인라인 전문 확보).

## 전체 위험도
**LOW** — target(`spec-draft-chat-channel-binder-drift.md`)은 실측 기반 정확도가 이례적으로 높은 spec 정합화 draft이며, 남은 문제는 전부 인용 정밀도·수치 재현성 수준의 WARNING/INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance (중복 통합) | 신설 예정 `R-CC-22` 초안이 `spec-impl-evidence.md` 인용 절 위치를 오귀속 — "넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지 않는 것과 같다" 문구를 "바로 그 절(R-1)에서" 못박았다고 서술하지만, 실측 결과 그 문구는 R-1 절(199~203행)이 아니라 §2.1 필드 정의 표(75~84행, 정확히는 81행)에 있음 | draft `## Rationale (spec 본문에 실을 근거)` 단락, `[spec-impl-evidence.md R-1]` 앵커 뒤 "바로 그 절에서 … 못박고 있다" 문장 | `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의(81행) vs `### R-1` 절(199~203행) | 이 문구가 그대로 `15-chat-channel.md` `R-CC-22`에 실리기 전에 인용 출처를 §2.1로 정정하거나, "R-1이 글로브 허용을 채택하는 근거는 §2.1의 같은 논지와 맞닿아 있다"처럼 두 절을 함께 인용하도록 수정 |
| 2 | convention_compliance | Rationale 근거 수치 "다른 spec 은 대부분 명시 경로다(633개 중 528개가 `*` 없음)"가 draft 자신이 "정본"이라 부른 파서(`review_guard._parse_frontmatter_code`)로 재현되지 않음 — 직접 재실행 결과 748개 중 607개(`status: implemented` 필터 시 595/484)로 나와 633/528과 불일치, 측정 방법·시점도 미기재 | draft `## Rationale` 단락, "다음 사람이 '왜 여기만 glob 인가'…를 묻기 때문이다" 문장 괄호 안 수치 | `spec/**/*.md` 전체 `code:` entry 전수(정본 파서 기준) | spec 반영 전 `_parse_frontmatter_code`로 재실행해 수치를 갱신하거나, 재현 안 되면 "다른 spec은 대부분 명시 경로다(정성적)"로 낮추거나 삭제 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | draft "## 안 하는 것" 항목이 `TriggersService:` 로그 리터럴의 소재 파일을 오귀속(`triggers.service.ts`라 서술하나 실제로는 전부 `chat-channel-binder.service.ts`, 83/250/253/288행) | draft `## 안 하는 것` 불릿 | 해당 불릿의 파일명을 `chat-channel-binder.service.ts`로 정정 |
| 2 | cross_spec | §1.3 표 헤더 제거 후 제안된 각주가 setup/teardown·rotate/cleanup 소유자만 밝히고, 3번째 행(PATCH가 거부하는 세 경우)의 실제 소유자인 `chat-channel-input-rules.ts`는 각주에서 누락 | draft 편집 (d), `spec/data-flow/14-chat-channel.md` §1.3 각주 제안 | 각주를 "setup/teardown은 binder, PATCH 검증(비밀 차단·사후 부착·provider 불변)은 chat-channel-input-rules.ts, 회전·cleanup은 triggers.service.ts" 세 갈래로 확장 검토 |
| 3 | rationale_continuity | 신설 `R-CC-22`가 `spec-impl-evidence.md R-1`(일반 원칙)만 인용하고, 같은 파일(`15-chat-channel.md`) frontmatter가 최초 커밋부터 `chat-channel/**`를 이미 glob으로 등재해 온 더 직접적인 문서 내부 선례는 인용하지 않음 — 근거 보강 기회 | draft `## Rationale` "상위 원칙은 이미 있다" 문단 | "`chat-channel/**`는 최초 커밋부터 glob이었다 — `triggers/` 쪽만 명시 경로로 남아 있던 예외를 없애는 것" 한 문장 추가 검토(필수 아님) |
| 4 | plan_coherence | 체크리스트의 "co-located 항목에 해소 주석" 추가가 아직 미실행(`[ ]`) — 대상 지적 자체는 이미 실질 해소됨(`f947b49f4`, §5.4.1.2) | target 체크리스트 | target 실행 시 해당 체크박스를 실제로 수행(신규 조치 아님, 이행 확인용) |
| 5 | naming_collision | `dto/chat-channel-config.dto.ts` 하나가 `15-chat-channel.md`의 새 glob과 `2-trigger-list.md`의 기존 `dto/**` glob 양쪽에 매칭되는 이중 커버리지 — draft 이전부터 존재했고 draft가 확대하지 않음(명시 경로→glob 치환만, 교집합 크기 불변) | draft 신규 glob `dto/chat-channel-*.dto.ts` | 조치 불요. 필요시 Rationale에 "이 glob이 `2-trigger-list.md`의 `dto/**`와 겹칠 수 있다" 한 줄 추가 가능 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | R-1 인용 위치 오류(WARNING) + 로그 리터럴 귀속 오류·§1.3 각주 완결성 갭(INFO 2건). glob 매칭 수·이동 심볼 9개 spec 전역 잔존 스캔·원문 verbatim 대조는 전부 실측과 일치 |
| rationale_continuity | LOW | 기존 Rationale 위반 없음. R-CC-22가 문서 내부 glob 선례 미인용(INFO, 보강 기회). 인용된 커밋 해시·가드 상수·이동 심볼 9개 전부 재현 검증됨 |
| convention_compliance | LOW | spec-impl-evidence.md 인용 위치(WARNING, cross_spec과 중복) + "633/528" 수치 재현 실패(WARNING). glob 매칭·wildcard 상한·이동 후 심볼 소재·원문 6블록은 전부 일치 |
| plan_coherence | LOW | 신규 CRITICAL/WARNING 없음. 직전 세션(20_33_26) 지적 WARNING 3건 전부 흡수 확인. co-located 완료 주석 미실행만 INFO |
| naming_collision | NONE | 신규 식별자는 `R-CC-22`뿐(미사용 확인). 나머지는 이미 존재하는 코드 심볼의 뒤늦은 spec 등재라 정의상 충돌 여지 없음. dto glob 이중 커버리지는 사전 존재·미확대(INFO) |

## 권장 조치사항
1. spec에 `R-CC-22` 반영 전 `spec-impl-evidence.md` 인용 문구의 출처를 §2.1로 정정하거나 §2.1+R-1을 함께 인용하도록 수정 (WARNING #1)
2. "633개 중 528개" 수치를 `_parse_frontmatter_code`로 재실행해 갱신하거나 정성적 표현으로 완화/삭제 (WARNING #2)
3. draft "안 하는 것" 항목의 로그 리터럴 귀속 파일명을 `chat-channel-binder.service.ts`로 정정 (INFO #1)
4. §1.3 각주에 PATCH 검증 소유자(`chat-channel-input-rules.ts`) 추가 검토 (INFO #2)
5. `R-CC-22`에 `chat-channel/**` 기존 glob 선례 인용 추가 검토 (INFO #3, 선택)
6. co-located 완료 주석 체크박스를 실행 단계에서 실제로 체크 (INFO #4)
