## 발견사항

- **[INFO]** `single_turn` 모드 기본값 방어 코드 불일치
  - 위치: `custom-node.tsx:47` — `const mode = (data.config.mode as string) ?? "single_turn";`
  - 상세: `mode`가 `undefined`/`null`인 경우 `"single_turn"`으로 폴백하는 코드가 올바르게 동작하나, `mode`가 빈 문자열(`""`)인 경우 `?? `는 nullish coalescing이므로 폴백하지 않고 `multi_turn` 분기에 해당되지 않아 `single_turn` 경로로 진입함. 실질적 버그는 아니지만 의도 명확성 측면에서 주석 보강 또는 `|| "single_turn"` 사용을 고려할 수 있음.
  - 제안: 현 동작은 스펙과 일치하므로 기록 수준.

- **[INFO]** `mode` 파싱 코드 중복
  - 위치: `custom-node.tsx:47`, `custom-node.tsx:63` — `condPorts.length === 0` 분기 안과 밖 모두 `const mode = ...` 동일 선언
  - 상세: 로직상 문제는 없으나 useMemo 블록 내에서 동일 표현이 두 번 등장함. 가독성 저하 요소.
  - 제안: `useMemo` 블록 진입 시 한 번만 선언하도록 리팩토링 가능하나, 변경 범위가 현 PR 외부이므로 INFO 수준.

- **[INFO]** 스펙의 "포트 시각적 구분" 조항과 조건 0개 케이스 간 적용 범위 불명확
  - 위치: `spec/4-nodes/3-ai-nodes.md` — "포트 시각적 구분 (조건 ≥ 1인 경우)" 섹션
  - 상세: 스펙에 따르면 포트 시각적 구분(초록/파란/빨간 핸들, 점선 구분자)은 "조건 ≥ 1인 경우"에 한정. 조건 0개 시 `single_turn`은 `out`(파란) + `error`(빨간), `multi_turn`은 `user_ended`(파란) + `max_turns`(파란) + `error`(빨간) 2개 이상 포트가 렌더링되므로 `hasMultipleOutputs=true`가 되어 multi-output 레이아웃이 적용됨. 구현에서 포트 색상은 `port.type`(`system`→파란, `error`→빨간)으로 올바르게 분기되나, 점선 구분자(`showSystemDivider`) 로직이 조건 0개 케이스에서도 활성화될 수 있음 — `data` 타입 포트가 없으므로 실제로 구분자는 렌더링되지 않아 스펙과 일치함. 추가 테스트는 필요 없으나 명시적 확인 가치 있음.
  - 제안: 현 구현은 올바름. 기록 수준.

- **[INFO]** 테스트에서 `mode` 미설정 시 `single_turn` 폴백 케이스 미검증
  - 위치: `custom-node.test.tsx:264–278`
  - 상세: 첫 번째 테스트(`renders ai_agent with out and error ports when no conditions`)는 `config: { mode: "single_turn" }`으로 명시적 모드 설정. `config: {}`(mode 미설정) 시 `single_turn` 폴백이 동일하게 동작하는지 검증하는 케이스가 없음. 스펙상 기본값은 `single_turn`이므로 방어 경로 커버리지 미비.
  - 제안: `config: {}` 케이스로 `handle-out`과 `handle-error` 존재 확인 테스트 추가 권장.

---

## 요약

이번 변경은 스펙 변경(`조건 0개일 때 하위 호환 out 포트 → 모드별 시스템 포트 항상 표시`)을 구현과 테스트에 일관되게 반영하고 있으며, 스펙·구현·테스트 3자가 정합성을 유지하고 있다. `multi_turn` 모드에서 `out` 포트를 제거하고 `user_ended + max_turns + error`로 대체하는 비즈니스 로직이 `useMemo` 내에 정확히 구현되어 있고, 테스트도 해당 분기를 적절히 커버한다. 발견된 이슈는 모두 INFO 수준으로, `mode` 미설정 폴백 경로에 대한 테스트 케이스 한 건이 누락된 것이 가장 실질적인 개선 사항이다. `mode` 변수 중복 선언은 기능적 결함이 아닌 가독성 문제이며, 스펙의 포트 시각적 구분 조항은 조건 0개 케이스에서도 실질적으로 올바르게 동작한다.

## 위험도

**LOW**