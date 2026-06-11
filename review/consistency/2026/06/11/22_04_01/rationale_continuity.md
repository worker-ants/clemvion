# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/4-nodes/5-data/, diff-base=origin/main)
검토 일시: 2026-06-11

---

## 발견사항

### [INFO] spec §4 step 2 — 코드 래퍼 형식이 실제 구현과 불일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §4 (실행 로직) step 2
- **과거 결정 출처**: 해당 없음 (Rationale 항목 아님 — spec body 정확도 문제)
- **상세**: spec §4 step 2는 코드 래핑 형식을 `(async () => { "use strict"; <code> })()` 로 기술한다. 실제 구현(`wrapUserCode`, `code.handler.ts`)은 isolate 경계를 통한 JSON-safe 직렬화를 위해 중첩 async arrow + `JSON.stringify` 반환 형태로 변경됐다. 이 차이는 외부 행동(사용자 return 값이 output에 그대로 담김)에는 영향이 없고 Rationale 원칙 위반도 아니나, spec body가 내부 구현 형식을 명시하고 있어 부정확하다.
- **제안**: spec §4 step 2의 래핑 형식 서술을 "isolate `compileScript` 로 컴파일한다 (내부적으로 `async` IIFE 로 래핑 — 상세는 구현 참조)" 수준으로 추상화하거나, 현재 wrapUserCode 구조를 반영하도록 갱신한다.

---

### [INFO] spec §4 step 6 — `varsClone` 표현이 실제 sync-back 경로와 불일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md` §4 (실행 로직) step 6
- **과거 결정 출처**: 해당 없음 (Rationale 항목 아님 — 기술 정확도 문제)
- **상세**: spec §4 step 6는 "정상 종료 시 `varsClone` 을 `context.variables` 에 원자적으로 전체 덮어쓰기" 라고 기술하지만, 실제 구현은 `jail.get('$vars', { copy: true })` 로 격리 환경에서 사용자가 변경한 `$vars`를 읽어와서 씀. `varsClone`은 copy-out 실패 시의 fallback으로만 사용된다. 기술 방향이 거꾸로 돼 있어, "원본 clone을 되돌린다" 가 아니라 "격리 환경에서 최종 상태를 읽어 원자적으로 교체한다" 가 맞다. 다만 §4.5 Rationale에서 확립된 핵심 원칙(deep clone + atomic full replace + throw 시 롤백 / Proxy 기반 변경추적 기각)은 구현에서 모두 유지된다.
- **제안**: spec §4 step 6를 "정상 종료 시 격리 환경의 최종 `$vars` 를 읽어 `context.variables` 에 **원자적으로 전체 교체** (§4.5). copy-out 실패 시 `varsClone` (실행 전 스냅샷) 으로 폴백 — 원본 보존" 으로 수정한다.

---

## 요약

`spec/4-nodes/5-data/2-code.md` 의 `isolated-vm` 전환 관련 Rationale 연속성은 전반적으로 양호하다. 과거 spec §7.1 이 "추후 `isolated-vm` 등으로 재검토" 라고 명시적으로 남겨 둔 로드맵 항목을 새 `## Rationale` 의 "격리 방식 `isolated-vm` 전환 — 위협 모델과 결정" 항목이 정식으로 **종결** 처리했고, 기각된 3개 대안(`worker_threads` 권한 박탈 / 컨테이너·gVisor 즉시 전환 / 현상 유지+frozen-prototype)도 Rationale에 모두 기재됐다. 기존에 확립된 설계 원칙(config.code raw echo / output root 직접 배치 / Proxy 기반 변경 추적 기각 / pre-flight throw vs runtime error 포트 분기)도 target spec에서 그대로 유지된다. 발견된 두 건은 모두 spec body 기술 정확도 문제(INFO)로, Rationale 원칙·합의 invariant의 번복이나 기각된 대안의 재도입은 없다.

## 위험도

LOW
