# Rationale 연속성 검토 결과

검토 모드: --impl-done, scope=spec/5-system/, diff-base=origin/main
변경 대상: spec/5-system/2-api-convention.md, spec/5-system/7-llm-client.md, spec/2-navigation/6-config.md, spec/data-flow/7-llm-usage.md

---

## 발견사항

### [INFO] `INVITATION_THROTTLE` / `SENSITIVE_ACTION_THROTTLE` 상수 명명 계층 역전

- **target 위치**: `spec/5-system/2-api-convention.md` §7 Rate Limiting 표, 신규 행 ("초대 발송/재발송")
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.5.1` Rationale 없는 본문 확정("Rate Limit | 분당 10건 (`INVITATION_THROTTLE`, `workspaces.controller.ts`)"), `spec/data-flow/12-workspace.md §1.2` ("rate limit: 초대 발급·재발송은 분당 10건(`workspaces.controller.ts` `INVITATION_THROTTLE`)")
- **상세**: 신규 api-convention.md 행은 상수명을 `SENSITIVE_ACTION_THROTTLE`(주) + `INVITATION_THROTTLE`(별칭)으로 기술하나, 기존 auth.md §1.5.1 과 12-workspace.md §1.2 는 `INVITATION_THROTTLE` 를 단일·주 이름으로 취급하고 있다. 또한 신규 행은 "provider probe 와 공통 tier 상수 `SENSITIVE_ACTION_THROTTLE`"라 서술하지만, 기존 provider probe 행은 해당 상수를 `PROVIDER_PROBE_THROTTLE`로만 표기한다. 두 상수가 동일 값(10/min)을 공유하는 별개 상수인지 아니면 `SENSITIVE_ACTION_THROTTLE` 하나로 통합된 것인지 spec 상 불명확하다. 이를 다루는 Rationale 이 어디에도 없다.
- **제안**: (a) auth.md §1.5.1 과 12-workspace.md §1.2 에 `SENSITIVE_ACTION_THROTTLE`(별칭) 설명을 추가하거나, (b) api-convention.md 행 기술을 `INVITATION_THROTTLE`(기존 주 이름)으로 맞추고 `SENSITIVE_ACTION_THROTTLE` 도입 근거를 Rationale 에 신설한다. provider probe 행(`PROVIDER_PROBE_THROTTLE`)과 별개 상수임을 명시하거나 통합 사실을 기록해야 한다.

---

변경된 나머지 항목(모델 목록 결과 수 방어적 상한 500 — `spec/5-system/7-llm-client.md`, `spec/2-navigation/6-config.md`, `spec/data-flow/7-llm-usage.md`)은 기존 Rationale 에서 기각·폐기된 대안을 재도입하거나 합의 원칙을 위반하는 요소가 없다. 결과 수 상한 500 은 신규 보호 기능으로 도입되었으며, 이 결정에 반하는 과거 결정이 존재하지 않는다.

---

## 요약

이번 변경(mc-cfg-polish)에서 기존 spec Rationale 의 기각·폐기 결정이 재도입되거나 합의된 설계 원칙이 위반되는 사례는 없다. 모델 목록 결과 수 상한 500 추가는 새로운 보호 기능으로 기존 invariant 와 무충돌하며, 관련 spec 세 곳에 일관되게 반영되었다. 단 api-convention.md 의 초대 throttle 행이 상수명 `SENSITIVE_ACTION_THROTTLE` 를 주 이름으로 도입하면서 기존 auth.md·12-workspace.md 에서 `INVITATION_THROTTLE` 를 주 이름으로 취급한 서술과 명명 계층이 역전되어, 두 문서 간 표기 불일치가 발생했다. 이를 다루는 Rationale 이 없어 독자 혼란이 우려되나, 기능적 합의 원칙 위반은 아니다.

## 위험도

LOW
