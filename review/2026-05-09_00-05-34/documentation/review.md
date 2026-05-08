## 발견사항

---

### **[WARNING]** `FakeExec` 타입에 삭제된 `executionPath` 필드가 잔존
- **위치**: `executions.service.spec.ts` — `FakeExec` 타입 정의, `baseFake` 함수
- **상세**: `Execution` 엔티티에서 `executionPath` 컬럼이 V035 마이그레이션으로 제거됐으나, 테스트 픽스처 타입(`FakeExec`)과 `baseFake({ executionPath: [] })` 기본값이 그대로 남아 있다. 테스트는 통과하지만, 이 타입이 실제 엔티티와 달라졌다는 사실이 코드를 읽는 사람에게 혼란을 준다. "왜 엔티티에 없는 필드가 타입에 있지?"라는 의문이 생길 수 있다.
- **제안**: `FakeExec` 에서 `executionPath: string[]` 제거. `baseFake`의 `executionPath: []`도 함께 제거. 이미 테스트 자체가 `executionNodeLogRepo`로 경로를 검증하고 있으므로 기능상 영향 없음.

---

### **[WARNING]** `execution.entity.ts` — 컬럼 제거에 대한 맥락 주석 없음
- **위치**: `execution.entity.ts` 전체 (변경 후 `recursionDepth` 아래)
- **상세**: `executionPath` 컬럼이 조용히 사라졌다. 나중에 이 엔티티를 읽는 사람은 이게 버그인지 의도적 이행인지 알 수 없다. git blame을 뒤지거나 마이그레이션 파일을 찾아야 한다.
- **제안**: `recursionDepth` 아래에 한 줄 주석 추가.
  ```ts
  // executionPath is tracked in execution_node_log table (V035).
  ```

---

### **[WARNING]** §9.2 Redis 키 네이밍 표에 `exec:recover:lock` 누락
- **위치**: `spec/5-system/4-execution-engine.md` §9.2
- **상세**: §7.4에서 `exec:recover:lock`을 분산 lock 키로 명시하지만, §9.2의 "용도별 키 정의 및 TTL" 표에는 이 키가 없다. 더불어 이 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 따르지 않는다(workspaceId 세그먼트 없음). 이 불일치가 운영자나 신규 개발자에게 혼란을 줄 수 있다.
- **제안**: §9.2 표에 행 추가:
  ```
  | `exec:recover:lock` | 부팅 시 stuck recovery 분산 lock (전역, workspace 미분리) | 60초 |
  ```
  패턴 예외임을 각주 또는 주석으로 명시.

---

### **[INFO]** `ExecutionNodeLog`가 두 모듈에 이중 등록된 이유 설명 없음
- **위치**: `executions.module.ts`, `execution-engine.module.ts`
- **상세**: 동일 엔티티(`ExecutionNodeLog`)가 두 모듈의 `TypeOrmModule.forFeature`에 각각 등록되어 있다. TypeORM에서는 Repository를 사용하려는 모듈마다 개별 등록이 필요하지만, 이 사실을 모르는 개발자는 "중복 아닌가?" 하고 제거를 시도할 수 있다.
- **제안**: 한쪽(또는 양쪽) 등록 위치에 짧은 주석 추가.
  ```ts
  // ExecutionNodeLog: 이 모듈도 Repository를 직접 주입받으므로 별도 등록 필요.
  ```

---

### **[INFO]** `execution-node-log.entity.ts` JSDoc 언어 불일치
- **위치**: `execution-node-log.entity.ts` 클래스 주석
- **상세**: 이 파일의 클래스 JSDoc은 영어로 작성됐고, 동일 PR에서 변경된 `continuation-bus.service.ts`, `execution-engine.service.ts`의 JSDoc은 한국어로 작성되어 있다. 언어 일관성이 없어 유지보수 시 기준이 모호해진다.
- **제안**: 프로젝트 규약에 맞춰 한국어 또는 영어로 통일. 현재 다른 파일들이 한국어를 주로 사용하므로 한국어로 변환 권장.

---

### **[INFO]** `dispatch` private 메서드 — 복잡한 오류 분기에 주석 없음
- **위치**: `continuation-bus.service.ts:dispatch()`
- **상세**: 이 메서드는 JSON 파싱 실패, 구조 검증 실패, 핸들러 오류를 각각 다른 log level(`warn` vs `error`)로 처리하는 세 단계 방어 로직을 갖고 있다. 각 분기의 의도("왜 파싱 실패는 warn인데 핸들러 오류는 error인가?")가 불명확하다. `on` 메서드 JSDoc에 "마지막 등록만 유지" 정책이 적혀 있는 것과 비교하면 `dispatch`의 내부 설계 근거가 상대적으로 설명이 부족하다.
- **제안**: 세 분기 각각에 한 줄 주석으로 의도 명시 (현재 파싱 실패 `warn`은 외부 발신 오류, 핸들러 `error`는 내부 버그임을 구분).

---

### **[INFO]** `V035__execution_node_log.conf` 파일 자체 설명 없음
- **위치**: `V035__execution_node_log.conf`
- **상세**: `.conf` 파일에 `executeInTransaction=true`만 있고 맥락이 없다. 이유는 `.sql` 파일 헤더에 설명되어 있으나, `.conf` 파일만 단독으로 볼 때 의도를 알기 어렵다. 일부 Flyway 환경에서 conf와 sql 파일이 다른 경로에서 열람될 수 있다.
- **제안**: 해당 파일이 짝을 이루는 SQL 파일과 세트임을 명시하는 주석 허용 여부를 확인 후 추가 검토. (Flyway conf 파일은 주석을 지원하지 않으므로, 현 상태 유지도 무방.)

---

## 요약

전반적으로 문서화 수준이 높다. `continuation-bus.service.ts`의 설계 근거 JSDoc, `execution-engine.service.ts`의 분산 아키텍처 설명, `spec/5-system/4-execution-engine.md` §7.4의 ASCII 흐름도 및 표 구성은 복잡한 분산 시스템 변경 치고는 매우 충실하다. 주요 미비점은 두 가지로 압축된다: (1) 삭제된 `executionPath` 필드의 흔적이 테스트 타입과 엔티티 파일에서 조용히 처리되어 이행 맥락이 남지 않은 점, (2) §9.2 Redis 키 표가 §7.4에서 새로 도입한 전역 lock 키를 반영하지 못한 점.

## 위험도

**LOW**