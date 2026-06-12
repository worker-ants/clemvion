# Performance Review

## 발견사항

### 파일 1: chat-channel.controller.spec.ts
- **[INFO]** 테스트 파일 정리 — 성능 영향 없음
  - 위치: 전체 diff
  - 상세: `UnauthorizedException` import 제거 및 테스트 케이스 1건 삭제. 테스트 파일은 런타임 성능과 무관하다.
  - 제안: 해당 없음.

### 파일 2: chat-channel.controller.ts
- **[INFO]** `@WorkspaceId()` 데코레이터로 교체 — 성능 중립 또는 미세 개선
  - 위치: `rotateBotToken` 메서드 파라미터 (라인 ~45)
  - 상세: 기존에는 `@Headers('x-workspace-id')` 로 헤더만 읽고 수동 `if (!workspaceId)` 검사를 했다. 공용 `@WorkspaceId()` 데코레이터는 헤더 + JWT `workspaceId` 두 경로를 한 번에 처리한다. 데코레이터 내부에서 파이프라인이 파라미터 파싱 시점에 한 번만 실행되므로 중복 검사가 줄어든다. 추가 함수 호출 오버헤드는 나노초 수준이며 무시 가능하다.
  - 제안: 해당 없음.

- **[INFO]** 수동 인라인 검증 제거
  - 위치: 삭제된 `if (!workspaceId)` 블록 (라인 ~53-58)
  - 상세: 중복 guard가 제거되어 매 요청마다 불필요한 조건 분기 하나가 사라진다. 성능 영향은 무시 가능한 수준이지만 코드 경로가 간결해진다.
  - 제안: 해당 없음.

### 파일 3~4: triggers.en.mdx / triggers.mdx
- **[INFO]** 문서 문자열 변경 — 성능 영향 없음
  - 위치: `<Callout type="warn">` 내 에러코드 목록
  - 상세: `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 로 단순 문자열 치환. 빌드 산출물 크기 변화 없음 (바이트 수 동일).
  - 제안: 해당 없음.

### 파일 5: plan/complete/code-node-isolated-vm.md
- **[WARNING]** isolated-vm per-exec Isolate 생성 비용 — 후속 최적화 필요 (이미 인지된 항목)
  - 위치: 플랜 문서 §운영영향 주석
  - 상세: 플랜 자체에 "code 노드 실행 latency·메모리 프로파일 변화 가능(per-exec dayjs 컴파일 — 후속 snapshot 최적화 여지)" 가 명시되어 있다. `ivm.Isolate` 생성은 V8 Isolate 초기화 비용(수 ms~수십 ms)을 매 실행마다 지불한다. 사용량이 낮을 때는 무해하지만, 고빈도 code 노드 실행 시 누적 latency가 문제가 될 수 있다. 이미 followups 플랜으로 분리되어 있어 본 PR의 추가 액션 대상은 아니다.
  - 제안: 후속 PR에서 Isolate pool 또는 snapshot 재사용 전략을 적용하면 per-exec 초기화 비용을 제거할 수 있다. (이미 `code-node-isolated-vm-followups.md`에 추적 중)

- **[INFO]** `ExternalCopy` 직렬화 비용
  - 위치: 플랜 §구현 — 데이터 주입 및 결과 반환
  - 상세: 입력 데이터(`$input`/`$vars`/`$execution`/`$node`) 와 결과를 `ExternalCopy` 로 직렬화/역직렬화한다. 페이로드가 클 경우(예: 수백 KB 이상의 `$input`) 직렬화 비용이 증가한다. 현재 구현 범위에서 이를 제한하는 별도 상한은 spec에서 발견되지 않았다.
  - 제안: `$input` 크기를 미리 검사하거나 기존 code 노드 스펙에 입력 크기 상한이 정의되어 있다면 해당 제한을 isolate 입력 단계에서도 early-exit으로 적용하는 것이 좋다.

### 파일 6: plan/in-progress/chat-channel-workspace-code-unify.md
- **[INFO]** 플랜 문서 — 성능 영향 없음
  - 위치: 전체 파일
  - 상세: 작업 추적 문서. 실행 경로에 영향을 주지 않는다.
  - 제안: 해당 없음.

### 파일 7: spec/5-system/15-chat-channel.md
- **[INFO]** spec 표·텍스트 변경 — 성능 영향 없음
  - 위치: §5.4 에러 표, §6 텍스트 패치
  - 상세: `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 정합 수정 및 `EiaAiMessageEvent` → `EiaEvent` 명칭 정정. 런타임 코드와 무관한 사양 문서 변경.
  - 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 `chat-channel.controller.ts` 에서 수동 헤더 파싱·검증을 공용 `@WorkspaceId()` 데코레이터로 교체한 것이다. 성능 관점에서 매 요청마다 중복 조건 분기 하나가 제거되는 미세 개선이 있으며, 나머지 변경(문서·spec·플랜 파일)은 런타임에 영향을 주지 않는다. 유일하게 주목할 선행 항목은 `isolated-vm` per-exec Isolate 생성 비용인데, 이는 이미 followups 플랜으로 추적되고 있으며 본 PR에서 새로 도입된 내용이 아니다. 전반적으로 성능 위험도는 낮다.

## 위험도

LOW
