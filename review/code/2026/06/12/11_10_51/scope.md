# 변경 범위(Scope) 리뷰 결과

## 리뷰 대상

- `codebase/backend/src/nodes/data/code/code.handler.ts`
- `codebase/backend/src/nodes/data/code/code.handler.spec.ts`

## 변경 의도

두 커밋으로 구성된 PR:
1. `fcd0d61d` — `perf(code-node)`: dayjs UMD를 `ivm.Isolate.createSnapshot`으로 1회 베이크하여 per-exec 재컴파일 제거
2. `8cfa397a` — `fix(code-handler)`: 이전 ai-review SUMMARY#1/#2/#3 대응 (isolate 옵션 중복 제거, fallback warn, 테스트 보강)

---

## 발견사항

### [INFO] `DAYJS_LOAD_SCRIPT` 상수 추출 — 범위 내 리팩토링
- 위치: `code.handler.ts` 모듈 상단
- 상세: 기존에 인라인 템플릿 리터럴 `${DAYJS_SOURCE}\n;globalThis.dayjs = dayjs;`로 두 곳에 쓰였던 표현을 `DAYJS_LOAD_SCRIPT` 상수로 추출했다. 스냅샷 기능 구현에 필수적으로 수반되는 변경이므로 범위 이탈이 아니다.
- 제안: 없음 (정당한 DRY 적용)

### [INFO] `DAYJS_SNAPSHOT` IIFE + `createSnapshot` 실패 시 `console.warn` 추가
- 위치: `code.handler.ts` 모듈 스코프
- 상세: snapshot 실패 알림 추가는 ai-review INFO#3 대응으로 명시적으로 추적된 변경이다. 범위 내.
- 제안: 없음

### [INFO] `isolateOptions` 패턴 도입 (`ConstructorParameters` 활용)
- 위치: `code.handler.ts` `execute()` 내부
- 상세: 조건부 두 번 `new ivm.Isolate(...)` 호출을 하나의 옵션 객체로 통합한 것은 ai-review SUMMARY#2(Maintainability) 대응으로 추적된 변경이다. 범위 내.
- 제안: 없음

### [INFO] `BOOTSTRAP_SOURCE` 재컴파일 근거 주석 추가
- 위치: `code.handler.ts` `execute()` `if (!DAYJS_SNAPSHOT)` 블록 이후
- 상세: ai-review SUMMARY#3(WON'T FIX 근거)에 해당하는 설명 주석이다. 기능 변경 없이 주석만 추가됐으며 추적된 변경 내.
- 제안: 없음

### [INFO] 테스트 `checkIndices` 루프 내 값 검증 추가
- 위치: `code.handler.spec.ts` `stays consistent across many sequential executions` 테스트
- 상세: ai-review INFO#4 대응으로 명시된 강화 변경. 기존 성공 플래그만 검사하던 루프에서 i=0,12,24 구간에 대한 output 값도 검사한다. 스냅샷 재사용 정확성 계약 보강 — 범위 내.
- 제안: 없음

### [INFO] `W-D` 테스트 블록 (`DAYJS_SNAPSHOT=undefined` fallback 경로)
- 위치: `code.handler.spec.ts` 신규 `describe` 블록
- 상세: ai-review SUMMARY#1(Testing) W-D 대응으로 추적된 테스트다. `jest.isolateModules`를 통해 createSnapshot 미지원 환경 분기를 커버하는 단위 테스트 — 범위 내.
- 제안: 없음

### [INFO] 보안 테스트 `should isolate the host realm from $helpers.date return value` — 기존 PR(C-2)의 red→green 회귀 테스트
- 위치: `code.handler.spec.ts` `execute — $helpers` describe 블록
- 상세: 이 테스트는 현재 리뷰 대상 PR이 아닌 이전 PR `#546`(feat: isolated-vm 격리 전환)의 커밋(`a9981649`)에서 추가됐다. 현재 PR의 범위 파일에 해당 테스트가 포함되어 있으나, 현재 diff에는 변경이 없다(이미 존재하는 코드). 범위 이탈 없음.
- 제안: 없음

---

## 추가 확인 사항

현재 PR에서 변경된 파일은 `code.handler.ts`와 `code.handler.spec.ts` 두 파일뿐이며, 두 커밋 모두 명시적으로 추적된 변경 항목(perf 기능 + ai-review 후속 처리)에 대응한다. 다른 파일 영역(스키마, 에러 코드, 인프라 설정, 다른 노드 핸들러 등)에 대한 변경은 포함되지 않았다. 포맷팅 전용 변경이나 무관한 임포트 수정도 발견되지 않았다.

---

## 요약

두 커밋 모두 "dayjs UMD 스냅샷화를 통한 per-exec 재컴파일 제거" 라는 단일 성능 목표와 그에 대한 ai-review 후속 처리에 집중되어 있다. 모든 변경 항목(상수 추출, 스냅샷 IIFE, isolate 옵션 통합, fallback warn, 주석 보강, 테스트 5건 + fallback 테스트)이 해당 목적에서 직접 파생되거나 명시적으로 추적된 ai-review 대응 항목이다. 의도된 범위를 벗어난 변경은 발견되지 않았다.

## 위험도

NONE
