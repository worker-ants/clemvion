### 발견사항

- **[INFO]** `finalizeGuarded` CANCELLED 재진입 분기의 방어적 fallback(`row` 자체가 없는 경우)이 여전히 테스트 없음 — 3라운드째 인지·유예 상태
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:661-673` (`finalizeGuarded`, `.returning(['duration_ms','finished_at'])` 이후 `if (persistedDuration !== null)` / `if (persistedFinishedAt !== null)` 두 조건이 **거짓**이 되는 경로 — 즉 `affected>0` 인데 `result.raw` 가 비어 있거나 `toFiniteNumber`/`toPersistedDate` 가 파싱 불가로 `null` 을 돌려주는 경우)
  - 상세: `retry-turn.service.spec.ts` 신규 테스트는 `affected: 0`(되쓰기 블록 미진입)과 `affected: 1` + 파싱 가능한 값(정상 되쓰기) 두 경우만 다룬다. `affected>0` 인데 `raw` 가 비정상(빈 배열/undefined)이거나 컬럼값이 파싱 불가라 로컬 값을 **조용히 보존**하는 분기는 여전히 관측되지 않는다. 두 헬퍼(`toFiniteNumber`/`toPersistedDate`) 자체는 `terminal-duration.spec.ts` 에서 경계값이 촘촘하지만, 이 서비스 레벨 통합에서 그 `null` 반환이 실제로 "로컬 값 유지"로 이어지는지는 확인된 바 없다. 이미 직전 두 라운드(`13_58_27` concurrency, `15_00_41` testing)가 "이론적 케이스, 우선순위 낮음"으로 평가·유예했고 이번 라운드에도 상태 변화가 없다 — 새 결함이 아니라 기존 유예의 재확인.
  - 제안: 조치 불요(참고용 유지) — 실제 드라이버가 이 형태를 낼 관측이 생기면 그때 fixture 로 고정.

- **[INFO]** `it.each` 목록 기반 nullable 회귀 가드는 여전히 "손으로 고른 목록 자체가 커버리지"라는 이 저장소의 반복 함정 구조를 갖는다 — 이번엔 자체 주석으로 명시하며 고쳐 회귀는 아님
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:122-124` (`it.each([['result'], ['error'], ['durationMs']])`)
  - 상세: `14_47_14` 라운드 WARNING(형제 필드는 커버하는데 `durationMs` 가 목록에서 빠짐)을 이번 diff 가 정확히 닫았다. 다만 목록 확장 자체가 근본 해결은 아니라서, 코드 주석이 스스로 "새 nullable 필드를 여기 넣지 않으면 규약을 어겨도 조용히 통과한다"고 남겨 뒀다 — 다음에 nullable 필드가 추가될 때 또 수동 등재가 필요하다는 구조적 한계가 남는다. 같은 `describe` 블록이 `type: 'integer'` 같은 스키마 세부는 검증하지 않고 `nullable` 만 본다.
  - 제안: 조치 불요 — 이미 자체 인지·문서화됨. 장기적으로 스키마 프로퍼티를 순회하며 `description` 규약(§5.4 대상 필드 명시)을 정적으로 검증하는 메타 테스트로 전환하면 수동 등재 의존을 없앨 수 있으나 이번 PR 스코프는 아니다.

- **[INFO]** `returningSpy` 가 `describe` 스코프 `let` 으로 선언되지만 단일 `it` 안에서만 할당·사용된다 — 사소한 스코핑 넓힘
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:922` (`let returningSpy: jest.Mock;`) — 실사용은 `:1318,1325,1367` 한 테스트 안
  - 상세: 다른 테스트에서 참조하지 않으므로 함수형으로는 문제없지만, `describe` 블록 상단에 선언돼 있어 "여러 테스트가 공유하는 상태"로 오독될 여지가 있다. 테스트 격리 자체는 깨지지 않는다(다음 테스트가 이 변수를 읽지 않음).
  - 제안: 해당 `it` 블록 내부에서 `const returningSpy = jest.fn()...` 로 지역화하면 스코프가 실제 사용 범위와 일치해 가독성이 개선된다. 우선순위 낮음.

### 회귀·격리·가독성 (확인 완료, 문제 없음)

- `finalizeCancelledExecution` 신규 describe(`execution-engine.service.spec.ts:1072-1163`)는 직전 라운드(`15_00_41`)가 지적한 "`finishedAt` 되쓰기 미검증" WARNING을 정확히 닫았다 — `arrange()` 의 `live` fixture 에 `LIVE_FINISHED_AT` 을 추가하고 test (a)에서 `exec.finishedAt` 을 직접 단언한다(1072-1136행). (a)/(b)/(c)/(d) 네 갈래(DB=cancelled→emit / 다른 종결자 승리→skip / 행 부재→fail-closed skip / 재조회 throw→전파하지 않고 skip)로 정확히 갈렸고, `mockResolvedValueOnce`/`mockRejectedValueOnce` 를 일관되게 써 테스트 간 mock 누수가 없다.
- `retry-turn.service.spec.ts` 의 `.returning(['duration_ms','finished_at'])` 호출 자체를 스파이로 단언(`returningSpy`)하고, `startedAt` 을 10분 전으로 설정해 로컬 재계산값(T2)과 DB 보존값(T1)이 실제로 갈리는 discriminating fixture 를 쓴다 — `13_58_27` RESOLUTION 이 기록한 "호출 자체를 지워도 GREEN" 결함이 재발하지 않도록 판별력을 갖췄다. `finished_at` 을 pg 드라이버 실측 형태인 **문자열**로 줘 `toPersistedDate` 의 문자열 분기까지 태운다.
- `terminal-duration.spec.ts` 의 `toPersistedDate` 신규 테스트는 Date 인스턴스 통과·ISO 문자열 파싱과, `it.each` 로 null/undefined/빈 문자열/공백/비-날짜 문자열/Invalid Date 객체/숫자/객체 8종의 실패 케이스를 모두 `null` 로 좁혀 경계값 커버리지가 촘촘하다. `toFiniteNumber` 와 대칭 설계도 정확히 반영됐다.
- `interaction.service.spec.ts` 의 신규 테스트 3종(영속값 그대로 싣기 / `durationMs: 0` 을 `??`→`||` 뮤턴트로 가르는 경계 / 종결 전 `null`(키 존재))과 `STATUS_PROJECTION_COLUMNS` 정확집합 가드에 `durationMs` 추가는 각각 다른 실패 모드를 겨냥해 판별력이 있다. `makeMocks()`/`makeExecution()` 이 매 테스트 새 mock/fixture 를 만들어 격리도 유지된다.
- 이번 라운드까지 누적된 diff 는 `13_58_27`(WARNING 10) → `14_47_14`(WARNING 2) → `15_00_41`(WARNING 4) 세 라운드의 테스트 관점 WARNING을 전부 조치·뮤테이션으로 재확인한 상태다. 새로 도입된 코드 경로(`finalizeCancelledExecution` 0행 재조회, retry-turn `RETURNING` 되쓰기, REST `durationMs` projection) 모두 해피패스·주요 실패 모드·경계값(0, null, 파싱 불가)에 대한 회귀 테스트를 갖췄다.

### 요약

이 PR 은 이미 세 차례의 코드 리뷰 라운드를 거치며 테스트 관점 WARNING 16건(누적)을 전부 뮤테이션으로 판별력을 확인하며 닫았고, 이번 라운드에서 검토한 누적 diff 에도 그 수정 결과가 정확히 반영돼 있다(특히 `finalizeCancelledExecution` 의 `finishedAt` 되쓰기 미검증 WARNING과 `durationMs` nullable 스키마 가드 누락 WARNING이 이번 diff 안에서 닫힌 채로 확인됨). 새로 발견한 것은 이미 두 차례 인지·유예된 이론적 fallback 경로(테스트 안 됨이지만 저확률·현재 드라이버로는 도달 불가)의 재확인과, 스코핑·구조적 한계에 대한 저위험 INFO 세 건뿐이다. CRITICAL·WARNING 급 신규 갭은 발견되지 않았다.

### 위험도

LOW
