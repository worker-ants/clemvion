# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 발견사항 없음

모든 변경이 의도된 목표(per-exec dayjs 재컴파일 제거를 위한 `ivm.Isolate.createSnapshot()` 도입)의 범위 안에 있다.

**`code.handler.ts`**
- `DAYJS_LOAD_SCRIPT` 상수 추출: 기존 인라인 템플릿 리터럴(`${DAYJS_SOURCE}\n;globalThis.dayjs = dayjs;`)을 명명된 상수로 분리한 것은 스냅샷 생성(`createSnapshot`) 과 컴파일 fallback 양쪽에서 동일 스크립트를 참조해야 하므로 범위 내 필수 변경이다.
- `DAYJS_SNAPSHOT` IIFE 추가: 핵심 기능 변경. 스냅샷 미지원 플랫폼 대비 `try/catch → undefined` fallback 포함.
- `execute()` 내 분기(`DAYJS_SNAPSHOT ? ... : ...`): isolate 생성 시 snapshot 옵션 조건 전달, `if (!DAYJS_SNAPSHOT)` 로 per-exec 컴파일 건너뜀. 두 수정 모두 스냅샷 경로 구현에 직결된다.
- 기존 코드에 포맷팅, 임포트, 무관 로직 변경 없음.

**`code.handler.spec.ts`**
- 새 `describe('execute — dayjs snapshot path (perf follow-up)')` 블록 5개 테스트: dayjs parity, 연속 실행 일관성, 교차실행 프로토타입 오염 비캡처, logs/$input per-exec 비누적, §7.3 하드닝 유지 — 모두 새 스냅샷 경로의 정확성·격리 계약을 검증하는 테스트로 범위 내 필수 보강이다.
- 기존 테스트 코드 수정 없음.

**`plan/in-progress/code-node-isolated-vm-followups.md`**
- 해당 항목의 체크박스를 `[ ]` → `[x]`로 전환하고 완료 내역을 기술: 계획 문서의 상태 추적 업데이트로 범위 내 정상 변경이다.

## 요약

세 파일 모두 "per-exec dayjs 재컴파일을 스냅샷으로 대체" 라는 단일 목적에 직결된 변경만 포함하고 있다. 불필요한 리팩토링, 기능 확장, 무관한 코드 영역 수정, 포맷팅 변경, 임포트 변경, 의도하지 않은 설정 파일 변경은 없다. 변경 범위가 의도와 정확히 일치한다.

## 위험도

NONE
