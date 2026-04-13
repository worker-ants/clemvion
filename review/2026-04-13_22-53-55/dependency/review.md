### 발견사항

- **[INFO]** `WARNING` 상수가 사실상 사용되지 않는 데드 코드로 전락
  - 위치: `node-config-summary.ts:36` — `const WARNING = Object.freeze<ConfigSummaryResult>({ text: "\u26a0 Not configured", isWarning: true })`
  - 상세: 모든 formatter 함수가 이제 `null` 대신 `warning(detail)` 반환값을 직접 돌려준다. `getConfigSummary` 내부의 `if (!result) return { ...WARNING }` 분기는 절대 도달할 수 없는 dead path가 됐다. `WARNING` 상수 자체도 외부로 export되지 않으므로 참조 없음.
  - 제안: `WARNING` 상수와 `if (!result) return { ...WARNING }` 분기를 함께 제거. `getConfigSummary`의 반환 타입 단언도 정리 가능.

- **[INFO]** `FORMATTERS` 레지스트리의 타입 선언과 실제 함수 시그니처 불일치
  - 위치: `node-config-summary.ts` — `const FORMATTERS: Record<string, (config: NodeConfig) => ConfigSummaryResult | null>`
  - 상세: 변경된 formatter 함수들은 모두 `ConfigSummaryResult`(non-null)를 반환하도록 시그니처가 바뀌었지만, 레지스트리의 타입 선언은 여전히 `| null`을 포함하고 있다. `carouselSummary`도 구현상 항상 값을 반환하지만 타입은 `| null`로 선언되어 있다.
  - 제안: 레지스트리 타입을 `Record<string, (config: NodeConfig) => ConfigSummaryResult>` 로 좁혀 타입 안전성을 높인다.

---

### 요약

이번 변경은 신규 외부 패키지·라이브러리 추가가 전혀 없으며, 기존 의존성의 버전·라이선스·보안 취약점에도 영향을 주지 않는다. 변경의 본질은 모노레포 내부 유틸(`node-config-summary.ts`)의 경고 메시지 세분화 리팩터링이며, 테스트 어설션과 스펙 문서가 그에 맞춰 동기화됐다. 의존성 관점에서 식별된 유일한 사안은 `WARNING` 상수·dead code path 잔존과 `FORMATTERS` 레지스트리의 타입 선언 불일치로, 둘 다 런타임 동작에는 영향 없는 내부 모듈 정합성 문제다.

### 위험도

**LOW**