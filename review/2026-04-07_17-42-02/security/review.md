## 보안 코드 리뷰

### 발견사항

---

**[WARNING]** `MAX_NODE_ITERATIONS=0` 무제한 루프 허용
- **위치**: `execution-engine.service.ts` — `runExecution()` 내 iteration guard
- **상세**: `MAX_NODE_ITERATIONS=0`으로 설정하면 단일 노드가 무제한 반복 실행된다. 워크플로우 설계 버그 또는 악의적인 워크플로우 설정으로 서버 자원을 고갈시킬 수 있다 (CPU 점유, DB 과부하). 운영자가 실수로 `0`으로 설정하면 DoS 조건이 형성된다.
- **제안**: 무제한 모드(`0`)에 대해 절대 상한선(예: 10,000)을 별도로 두거나, 환경변수 허용 범위를 명확히 문서화하고 운영 환경에서는 `0` 설정을 경고 로그로 알린다.

```typescript
const maxNodeIterations = this.configService.get<number>('MAX_NODE_ITERATIONS', 100);
// 추가
if (maxNodeIterations === 0) {
  this.logger.warn('MAX_NODE_ITERATIONS=0: unlimited iterations enabled. Use with caution.');
}
```

---

**[WARNING]** 에러 메시지에 내부 노드 정보 노출
- **위치**: `execution-engine.service.ts:298`
- **상세**: 반복 초과 에러 메시지에 `node.label ?? node.type`과 `maxNodeIterations` 값이 포함된다. 이 메시지가 `savedExecution.error`에 저장되어 API 응답으로 클라이언트에 전달될 경우, 내부 워크플로우 구조(노드 라벨, 설정값)가 노출된다.
- **제안**: 에러 메시지를 사용자에게 반환하는 API 레이어에서 내부 구현 세부정보를 필터링하거나, 에러를 에러 코드(`MAX_ITERATIONS_EXCEEDED`)와 일반 메시지로 분리한다.

---

**[WARNING]** `identifyBackEdges` 결과의 비결정적 순서 — 보안보다 신뢰성 이슈
- **위치**: `back-edge-identifier.ts`, `execution-engine.service.ts:270`
- **상세**: `Set<string>` 기반 DFS는 노드 순회 순서가 JavaScript 엔진의 삽입 순서에 의존한다. 동일 그래프라도 노드 등록 순서에 따라 다른 엣지가 back-edge로 분류될 수 있다. 이는 기능적 비결정성이지만, 보안 관점에서 루프 제어 경계가 의도치 않게 달라질 수 있다.
- **제안**: DFS 시작 순서를 결정론적으로 고정(예: 노드 ID 정렬)하거나, 이 비결정성을 명시적으로 문서화한다.

---

**[INFO]** `configService.get` private 접근자를 통한 목 오버라이드
- **위치**: `execution-engine.service.spec.ts:851, 905`
- **상세**: 테스트 코드에서 `service['configService']`로 private 필드에 직접 접근하여 mock을 교체한다. 실제 보안 위험은 아니나, 이 패턴이 프로덕션 코드에서 모방될 경우 의존성 주입 보안 경계가 깨질 수 있다.
- **제안**: 테스트에서는 `Test.createTestingModule`의 provider override를 사용하는 것이 권장된다.

---

**[INFO]** 그래프 엣지 소스 노드 인증 없음
- **위치**: `back-edge-identifier.ts:28-32`
- **상세**: `adjacency` 구성 시 `sourceNodeId`가 nodeIds에 없는 엣지(외부 참조)는 조용히 무시된다. 하지만 `targetNodeId`가 nodeIds에 없는 엣지는 `forwardEdges`로 통과된다(코드 주석에도 명시). DB에서 로드된 데이터이므로 직접적인 injection 위험은 낮으나, 그래프 조작 가능성 방어를 위해 일관된 검증이 필요하다.
- **제안**: 현재 동작이 의도적이라면 스펙에 명시, 아니라면 양방향 모두 nodeIds 소속 여부를 검증한다.

---

### 요약

이번 변경은 사이클 감지 대신 back-edge 기반 루프 실행을 도입한 구조적 변경이다. 하드코딩된 시크릿, SQL 인젝션, 인증 우회 등의 직접적인 보안 취약점은 존재하지 않는다. 주요 위험은 `MAX_NODE_ITERATIONS=0` 설정을 통한 DoS 가능성으로, 운영 환경에서 잘못된 설정이 서버 자원 고갈로 이어질 수 있다. 에러 메시지를 통한 내부 정보 노출도 보완이 필요하다. 전반적으로 구현 품질은 양호하나, 무제한 반복에 대한 안전망 추가가 권장된다.

### 위험도

**LOW**