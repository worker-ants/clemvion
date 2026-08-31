# 정식 규약 준수 검토 — spec/5-system/6-websocket-protocol.md · spec/5-system/14-external-interaction-api.md

## 검토 범위와 방법

`--impl-done` 모드, scope=`spec/5-system/`, diff-base=`origin/main`. 실측 델타는 2개 파일이다.

- `spec/5-system/14-external-interaction-api.md` — §8.2 HMAC algorithm whitelist 서술 정정(`hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512` 두 값) + 서명 스킴 버전(`v1=`)과 `notification_secret_v2` DB 컬럼이 별개 축임을 명시하는 캐비엇 추가 + §11 상단의 WS 문서 cross-ref 앵커 정정(§4.6→§4.7).
- `spec/5-system/6-websocket-protocol.md` — §4 안에서 중복돼 있던 두 개의 "4.4" 절 번호(사용자 입력 대기 이벤트 상세 vs 알림 이벤트)를 해소. KB 문서 이벤트 절을 §4.2 직후·§4.4(사용자 입력 대기) 직전으로 옮겨 §4.3 으로 확정하고, 이후 절을 §4.4(유지)→§4.5(알림)→§4.6(시스템)→§4.7(외부 표면 매핑)으로 순번화. 본문 내부 self-reference 전량 갱신.

프롬프트 번들이 예산 절단으로 두 target 파일의 본문과 diff 를 생략했으므로, 워킹트리 절대경로에서 `Read`/`git diff origin/main...HEAD` 로 직접 재확인했다 (커밋 `50caf1a85`, `0883c4e43`).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 절 번호 정리가 앵커 안정성을 고려한 선택으로 보인다
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4 전체 재번호화
  - 위반 규약: 없음 (준수 확인 차원의 긍정 관찰)
  - 상세: 옛 문서는 "§4.4 사용자 입력 대기 이벤트 상세"와 "§4.4 알림 이벤트"가 번호를 공유하는 실질적 결함이 있었다. 이번 수정은 인용이 매우 많은 "§4.4 사용자 입력 대기" 쪽 번호는 그대로 두고, 인용이 적은 "알림/시스템/외부 표면 매핑" 3개 절만 5/6/7 로 미뤘다. 저장소 전체(`spec/**`)를 grep 한 결과 옛 번호(`#44-알림`, `#44-시스템`, `#45-시스템`, `#45-외부`, `#46-외부`, `#43-kb` 등)를 가리키는 잔존 링크는 0건이었고, `spec/data-flow/8-notifications.md` 의 4곳도 후속 커밋(`0883c4e43`, "§4.x 인용 12곳 정정")에서 함께 갱신되어 있었다. `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` 앵커를 인용하는 8개 이상의 타 spec 파일(§ai-agent.md, conversation-thread.md, interaction-type-registry.md, chat-channel-adapter.md 등)은 번호가 그대로라 깨지지 않는다.
  - 제안: 조치 불필요. 향후 유사 재번호화 시 이 패턴(고빈도 인용 절 번호 보존 + 저빈도 절만 이동)을 참고할 만하다.

- **[INFO]** HMAC algorithm whitelist 정정은 기존 Rationale(R12)·EIA-NX-03·구현과의 drift 를 없앤 것
  - target 위치: `spec/5-system/14-external-interaction-api.md` §8.2
  - 위반 규약: 해당 없음 — 오히려 `spec/5-system/14-external-interaction-api.md` 자체의 §R12("HMAC 알고리즘 표기 — inbound vs outbound 분리")·§3.1 EIA-NX-03 과의 내부 불일치를 해소
  - 상세: 옛 §8.2 는 "`hmac-sha256` 만. v2 추가 시 `v2=` prefix 로 병행" 이라 적어, 같은 문서의 R12/EIA-NX-03("`hmac-sha256`/`hmac-sha512` 둘 다 화이트리스트")과 모순됐다. 구현(`notification-config.dto.ts:39-47`)도 이미 `enum: ['hmac-sha256', 'hmac-sha512']` 로 두 값을 받는다. 새 §8.2 는 R12/코드와 정합하도록 정정됐고, `v1=`(서명 헤더 스킴 버전) 과 `notification_secret_v2`(DB 컬럼, §7.1 에 실존) 를 구분하는 캐비엇도 정확하다(§7.1 SQL DDL `notification_secret_v2 TEXT NULL` 확인).
  - 제안: 조치 불필요.

## 요약

이번 diff 는 두 spec 문서의 신규 요구사항·명명·출력 포맷을 도입하는 변경이 아니라, (1) `6-websocket-protocol.md` 내부에 있던 절 번호 중복(두 개의 "§4.4")을 해소하는 문서 구조 정리와 (2) `14-external-interaction-api.md` §8.2 의 HMAC algorithm whitelist 서술을 같은 문서의 기존 Rationale(R12)·요구사항(EIA-NX-03)·실제 구현(`notification-config.dto.ts`)과 일치시키는 정정이다. `spec/conventions/**` 의 명명·출력 포맷·문서 구조·API 문서·금지 항목 규약 중 위반되는 항목을 찾지 못했다. 오히려 두 변경 모두 기존 drift(중복 절 번호, R12 대비 본문 불일치)를 없애는 방향이며, 재번호화로 영향받는 cross-reference 를 저장소 전체(`spec/**`, `codebase/**`)에서 grep 해 확인한 결과 갱신 누락(dangling anchor)도 없었다. 문서 구조(Overview/본문/Rationale) 3섹션 관례도 두 파일 모두 유지된다 — `6-websocket-protocol.md` 는 다중 파일 영역(`spec/5-system/_product-overview.md`)의 하위 기술 명세이므로 자체 `## Overview` 가 없는 것이 정상이며, 이는 이번 diff 와 무관한 기존 구조다.

## 위험도

NONE
