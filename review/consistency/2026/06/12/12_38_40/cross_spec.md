# Cross-Spec 일관성 검토 결과

**Target**: `plan/in-progress/spec-draft-code-node-followups.md`
**대상 spec**: `spec/4-nodes/5-data/2-code.md`
**검토 일시**: 2026-06-12

---

## 발견사항

### 변경 3 관련

- **[WARNING]** `spec/4-nodes/0-overview.md §5` 의 메모리 제한 행 동기화 누락
  - target 위치: 변경 3-a (§7.2 리소스 제한 표), 변경 3-b (§5.3.3)
  - 충돌 대상: `spec/4-nodes/0-overview.md` §5 "메모리 제한" 행 — `"code 노드는 isolate memoryLimit: 128(MB) 하드 리밋"` 으로 하드코딩
  - 상세: target draft 는 §7.2 / §5.3.3 의 "128MB" 를 "기본 128MB (env 조정 가능)" 로 변경하도록 기술하나, `spec/4-nodes/0-overview.md §5` 의 샌드박싱 테이블 ("메모리 제한" 행) 은 `memoryLimit: 128(MB) 하드 리밋` 으로 하드코딩된 채로 남는다. 변경 3 을 code.md 에만 반영하고 0-overview.md 를 갱신하지 않으면 두 문서가 모순된다.
  - 제안: 변경 3 spec PR 에서 `spec/4-nodes/0-overview.md §5` "메모리 제한" 행도 "기본 128MB 하드 리밋 (env 조정 가능)" 로 함께 갱신한다. target draft 의 변경 3-b 에 이 파일을 명시적으로 포함하거나, draft 내 "변경 3" 섹션에 `spec/4-nodes/0-overview.md` 도 동기화 대상으로 추가한다.

- **[WARNING]** `spec/conventions/error-codes.md §4` 의 `EXECUTION_MEMORY_EXCEEDED` 설명과 잠재 drift
  - target 위치: 변경 3-a (§7.2 리소스 제한 표)
  - 충돌 대상: `spec/conventions/error-codes.md §4` — `EXECUTION_MEMORY_EXCEEDED` 의 의미를 `"isolate 128MB 하드 리밋 초과"` 로 고정 기술
  - 상세: error-codes.md §4 는 `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 매핑에 대한 의미 설명으로 `"isolate 128MB 하드 리밋 초과 (isolated-vm hard-kill)"` 을 기록한다. 변경 3 이 적용된 후에는 실제 리밋이 env 에 따라 다를 수 있어 "128MB" 가 의미 라벨에 박힌 근거 설명이 부정확해진다. 기능 동작(에러 발생 조건)은 변하지 않으므로 CRITICAL 은 아니나, 설명문이 stale 해진다.
  - 제안: `spec/conventions/error-codes.md §4` 의 해당 행 설명을 `"isolate 메모리 하드 리밋 초과 (기본 128MB, CODE_NODE_MEMORY_LIMIT_MB env 로 조정 가능 — isolated-vm hard-kill)"` 로 갱신하거나, 수치 없이 `"isolate 메모리 하드 리밋 초과 (isolated-vm hard-kill)"` 로 수정한다.

- **[WARNING]** `spec/5-system/3-error-handling.md §1` 의 Code 노드 에러 코드 설명에서 "128MB" 언급
  - target 위치: 변경 3-a
  - 충돌 대상: `spec/5-system/3-error-handling.md` — `CODE_MEMORY_LIMIT` 설명에 `"isolate 128MB 하드 리밋 초과"` 로 수치 박힘
  - 상세: 3-error-handling.md 는 Code 노드 에러 코드 카탈로그에서 `CODE_MEMORY_LIMIT` 를 `"isolate 128MB 하드 리밋 초과"` 로 설명한다. 변경 3 이후 실제 리밋이 env 가변이 되면 이 수치 라벨이 부정확해진다.
  - 제안: 변경 3 spec PR 에서 `spec/5-system/3-error-handling.md` 의 해당 설명도 "기본 128MB" 로 갱신하거나 수치를 제거한다.

### 변경 2 관련

- **[INFO]** `spec/4-nodes/5-data/2-code.md §7.3` — `TypeError` 이 허용 전역 내장 목록에 포함되어 있어 변경 2 와 일치하나, §2.2 표 설명 부재와의 조화 확인 권장
  - target 위치: 변경 2-a (§2.2 표)
  - 충돌 대상: `spec/4-nodes/5-data/2-code.md §7.3` 허용 목록 — `TypeError` 은 이미 허용 목록에 포함
  - 상세: 변경 2 가 `$helpers.base64.encode/decode` 에서 비문자열 입력 시 `TypeError` 를 throw 하도록 정렬하는 것은 §7.3 의 `TypeError` 허용 전역 내장과 일관적이다. 충돌이 아니라 정합 확인 사항이다.
  - 제안: 별도 조치 불필요. draft 의 변경 2-a 에서 `TypeError` 가 sandbox 내 허용임을 명시 참조(§7.3)하면 독자에게 더 명확하다.

### 변경 1 관련

- **[INFO]** `spec/4-nodes/0-overview.md §5` 의 "실행 격리" 행에서 snapshot 최적화 언급 부재
  - target 위치: 변경 1-b (§7.1 NOTE 추가)
  - 충돌 대상: `spec/4-nodes/0-overview.md §5` "실행 격리" 행
  - 상세: 변경 1 은 code.md §7.1 에 dayjs 스냅샷 최적화 NOTE 를 추가하나, `spec/4-nodes/0-overview.md §5` 의 "실행 격리" 행은 code.md 내 구현 세부를 직접 기술하지 않고 code.handler.ts 를 참조하는 구조여서 이 항목은 동기화 불필요이다. 변경 1 이 `spec/4-nodes/0-overview.md` 에 영향을 주지 않는다.
  - 제안: 별도 조치 불필요.

---

## 요약

Cross-Spec 일관성 관점에서 이 draft 의 가장 큰 위험은 **변경 3 (메모리 env 조정 가능화)** 이 `spec/4-nodes/5-data/2-code.md` 외부의 세 문서 — `spec/4-nodes/0-overview.md §5`, `spec/conventions/error-codes.md §4`, `spec/5-system/3-error-handling.md` — 에 하드코딩된 "128MB" 수치 설명과 drift 를 일으킨다는 점이다. 기능 계약(에러 코드, 포트 분기 방식)은 바뀌지 않으므로 CRITICAL 수준은 아니지만, 세 곳의 설명문이 spec 상 stale 해져 혼란을 줄 수 있다. 변경 1·2 에서는 다른 spec 영역과의 직접 모순이 없다. draft 를 채택할 때 변경 3 의 "연동 갱신 대상" 목록에 위 세 파일을 명시적으로 추가하거나 해당 행을 함께 갱신하면 일관성이 완전히 확보된다.

---

## 위험도

MEDIUM
