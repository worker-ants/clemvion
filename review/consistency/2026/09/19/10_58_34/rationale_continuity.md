# Rationale 연속성 검토 — spec/2-navigation/ (--impl-prep)

## 검토 범위와 방법

번들에 전문이 포함된 target 문서는 세 개뿐이었다 — `spec/2-navigation/1-workflow-list.md`,
`2-trigger-list.md`, `3-schedule.md`. 나머지 13개 navigation 문서(`4-integration.md`,
`5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `9-user-profile.md`,
`_product-overview.md`, `0-dashboard.md`, `7-statistics.md`, `10-auth-flow.md`,
`11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`,
`15-system-status.md`, `16-agent-memory.md`, `_layout.md`)와 `spec/5-system/*` 전 파일(auth ·
api-convention · error-handling · execution-engine · websocket · webhook · EIA ·
chat-channel 등)의 Rationale 발췌는 컨텍스트 예산 초과로 프롬프트에서 절단됐다.

`2-trigger-list.md` 가 R-CC-10 / R-CC-11 / R-CC-12 / R-CC-18 / R-CC-19 / R-CC-21(`spec/5-system/15-chat-channel.md`)과
WH-SC-01 / WH-EP-02 / inline-auth-폐지(`spec/5-system/12-webhook.md`)를 조밀하게 인용하고 있어, 이 두 파일은
"본문 생략됨" 을 근거 삼지 않고 `Read` 로 직접 열어 Rationale 절 전체(각 `## Rationale` 이하)를 대조했다.
그 외 5-system·나머지 navigation 문서는 이번 라운드에서 직접 열지 않았다 — 아래 INFO 참고.

## 발견사항

- **[INFO]** 검토 가능한 세 target 문서는 Rationale 연속성 관례를 모범적으로 지키고 있다
  - target 위치: `spec/2-navigation/2-trigger-list.md` R-2(§Rationale), R-17(§Rationale); `spec/2-navigation/1-workflow-list.md` §2.3 태그 필터 Rationale §4
  - 과거 결정 출처: 없음 — 오히려 target 자신이 선례
  - 상세: R-2("Webhook HMAC secret 입력 vs. rotate 분리")는 취소선으로 원문을 보존한 채 "폐기 — R-14 로 대체"를 명시하고, 대체 이유·TBD 항목이 왜 함께 소멸했는지까지 적었다. 태그 필터 §4는 "이 하향은 대안을 영구 기각하는 것이 아니라 범위 결정" 이라고 재확장 여지를 스스로 못박아, 향후 재도입이 "기각된 대안의 무단 재도입"으로 오판되지 않도록 방어해 뒀다. R-17은 "캐너리가 고정하는 것은 계약이 아니라 구현" 이라는 세밀한 구분까지 두어, 향후 구현 강화가 계약 위반으로 오독되는 것을 막았다. `spec/1-data-model.md` §Rationale의 `User` 컬럼 처분 항목도 동일한 패턴(표만 보고 "1행이 기각한 대안의 재도입"으로 오판할 위험을 스스로 지적)을 보인다 — 이 저장소 전반의 확립된 관례로 보인다.
  - 제안: 없음(현행 유지 권장)

- **[INFO]** endpointPath 전역 유일성(V131/V132) 반영이 `2-trigger-list.md` 내부에서 일관됨
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 Webhook Configuration 행, §3 PATCH 註
  - 과거 결정 출처: `spec/1-data-model.md` §Rationale "Webhook `endpoint_path` 전역 유일 (2026-09-18)", `spec/5-system/12-webhook.md` §Rationale "endpointPath 가변성 — webhook 은 mutable, schedule 만 frozen"
  - 상세: 오늘(2026-09-19) 병합된 데이터 모델 결정이 워크스페이스 단위 UNIQUE(V002)를 전역 UNIQUE(V132)로 교체했는데, target 의 두 언급(§2.3.1 · §3 PATCH 註) 모두 "전역 — 다른 워크스페이스의 트리거와도 겹칠 수 없다"로 이미 갱신돼 있어 drift 가 없다. `12-webhook.md` 의 mutable 결정("경로를 아는 사람의 복사는 전역 UNIQUE가 막는다")과도 정합.
  - 제안: 없음

- **[INFO]** chat-channel 관련 Rationale(R-CC-10/11/12/18/19/21) 참조가 현재 정본과 어긋나지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 Chat Channel 행들, §3 PATCH 註
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §Rationale 각 R-CC-* 항목(직접 Read 로 대조)
  - 상세: botToken/inboundSigning single-path 차단, `provider` 불변성, rate-limit skip+degraded 정책, workspace 검증 400 코드 등 target 이 인용하는 모든 결정이 인용된 앵커의 현재 서술과 문자 그대로 일치한다. 반대로 흘러가는 서술(예: PATCH 로 재등록 경로를 끊는 안)은 target 어디에도 재도입되지 않았다.
  - 제안: 없음

- **[INFO]** 컨텍스트 절단으로 미대조된 영역 — 후속 라운드 권장
  - target 위치: 이번 번들에서 본문이 생략된 13개 navigation 문서 + `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`·`6-websocket-protocol.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`17-agent-memory.md`
  - 과거 결정 출처: 해당 문서들의 `## Rationale` (미확인)
  - 상세: `2-trigger-list.md` §2.3.1의 EIA(External Interaction) 행이 `../5-system/14-external-interaction-api.md §4/§7.1/§7.3`을 참조하는데, 그 문서의 Rationale은 이번에 대조하지 못했다. "여기 없다는 사실을 관련 내용이 없다는 근거로 삼지 말라"는 번들 자체의 경고에 따라, 이 갭을 결함이 아니라 **미검증**으로 명시해 둔다.
  - 제안: 이번 impl-prep 작업(`plan/in-progress/entity-column-declaration-drift.md`, spec_impact: none)이 실제로 EIA/auth/execution-engine 영역의 트리거·스케줄 관련 서술을 건드리지 않는다면 이 갭은 이번 게이트를 막을 사유가 아니다. 다만 향후 그 영역을 만지는 작업이면 별도 라운드에서 `Read` 로 직접 대조할 것.

## 요약

전문이 확보된 세 target 문서(`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`)와, target 이 조밀하게 인용하는 `spec/1-data-model.md` · `spec/5-system/12-webhook.md` · `spec/5-system/15-chat-channel.md`의 `## Rationale` 전문을 직접 대조한 결과, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 사례는 발견되지 않았다. 오히려 이 영역은 폐기 결정에 취소선+대체 근거를 남기고, 하향 조정이 "영구 기각이 아니다"를 스스로 명시하는 등 Rationale 연속성 관례가 이례적으로 잘 지켜지고 있다. 다만 번들 컨텍스트 예산 때문에 13개 navigation 문서와 다수의 5-system 문서 Rationale 은 이번 라운드에서 대조하지 못했으므로 이는 "이상 없음"이 아니라 "미검증"으로 남긴다 — 이번에 진행 중인 개발 작업(엔티티 컬럼 선언 정정, spec_impact: none)이 그 영역의 서술을 바꾸지 않는 한 게이트를 막을 사유는 아니다.

## 위험도

NONE
