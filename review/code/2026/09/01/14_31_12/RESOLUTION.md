# RESOLUTION — 감사 로깅 잔여 리뷰 1라운드 반영

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **5**(SD1 + W1~W4) · INFO 14

Critical 은 없다. WARNING 5건 중 코드 스코프 4건을 전부 고쳤고, SPEC-DRIFT 1건은 `spec/`
쓰기라 planner 턴으로 처리한다(같은 PR 안, 별도 커밋).

## W1 — 같은 결함을 두 번째로, 그것도 경고가 붙어 있는 자리에서

`recordAuditWriteFailed` 의 **구현 자체를 어떤 테스트도 실행하지 않았다.** `audit-logs.spec.ts`
는 이 메서드를 `jest.fn()` 스텁으로 대체하므로 "불렸는지" 만 보고, 카운터 이름 오탈자·라벨
키 뒤바뀜·클램핑 누락은 전부 조용히 통과한다.

두 가지가 겹쳐 특히 나쁘다:

1. **C-2 의 `getPublicUrl` 과 정확히 같은 결함**이다 — 신설 메서드를 소비 쪽에서 mock 으로
   덮어 놓고 구현은 한 번도 안 돌린 것.
2. 저장소가 **이 함정을 바로 옆 형제 테스트 주석에 이미 적어 두었다**:
   *"인터셉터 쪽 테스트는 이 메서드를 `jest.fn()` 스텁으로 대체하므로, 이 구현 자체는 어느
   테스트도 실행하지 않았다 — 형제 `record*` 메서드가 모두 여기 테스트를 갖는 이유와 같다."*

직접 테스트 2건을 형제와 같은 패턴으로 붙였다. 클램핑은 **65자**로 문다 — 64자를 넣으면
자르든 안 자르든 같은 값이라 클램핑을 제거해도 통과한다(분기를 못 가르는 fixture).

## W2 — 관측이 새 실패 경로가 되면 본말전도다

`record()` 의 존재 이유가 swallow 계약("감사 실패가 본 요청을 절대 깨뜨리지 않는다")인데,
catch 안에 넣은 `this.metrics?.recordAuditWriteFailed(...)` 가 무방비였다. 던지면 그 예외가
12개+ 특권 CRUD producer(시크릿 회전·삭제 포함)로 전파돼 계약을 정면으로 역행한다.

OTel Counter 는 실측상 non-throwing 이라 발동 가능성은 낮고 같은 패턴이
`idempotency.interceptor.ts` 에 선례로 있지만, 이 자리는 **chokepoint** 라 파급이 넓다.
자체 `try`/`catch` 로 감쌌다.

**그 계약을 무는 축이 없었다** — 뮤턴트 X5(try 제거)가 예측대로 GREEN 이었다. 축을 채우고
RED 를 확인했다.

## W3·W4

| # | 처리 |
|---|---|
| W3 | 클램핑 상한 `64` 가 `recordExecutionError`·`recordAuditWriteFailed` 두 곳에 매직넘버로 중복 → `PROMETHEUS_LABEL_MAX_LEN` + `clampLabel()` 로 공유. 값 자체가 cardinality 방어 계약이라 한쪽만 바뀌면 두 메트릭의 방어 강도가 조용히 갈린다 |
| W4 | CHANGELOG 절 추가. 선례 `clemvion.redis.fail_open` 도입 PR 이 같은 관례를 지켰다 |

## SD1 — planner 턴으로 (같은 PR, 별도 커밋)

실측으로 확인했다:

- `spec/5-system/_product-overview.md` NF-OB-07 카탈로그 표에 `clemvion.audit.write_failed`
  행이 없고, NF-OB-07 요약행의 도메인 나열에도 감사가 빠져 있다
- `spec/data-flow/1-audit.md:21-23` 이 **"실패는 로그로만 남는다"** — 이제 거짓이다
  (로그 + 카운터)
- `spec/data-flow/9-observability.md` 의 Rationale 이 스스로 *"새 소비자를 배선할 때 유니온과
  NF-OB-07 카탈로그 표를 동시에 넓히는 것이 규칙"* 이라고 못 박고 있다

선례(`clemvion.redis.fail_open`)도 전용 planner 턴으로 카탈로그를 갱신했다. C-2 와 같은
구조라 이대로면 `--impl-done` 이 BLOCK 된다.

## 작업 중 잡은 것 — 테스트가 통과하는데 파일이 깨져 있었다

W3 리팩터에서 상수를 `@Injectable()` 과 클래스 **사이**에 넣어 데코레이터가 `const` 에
붙었다. **테스트 21건은 그대로 통과했고 prettier 가 잡았다** — 이 spec 이
`new BusinessMetricsService()` 로 직접 조립해 DI 를 타지 않기 때문이다. GREEN 이 증거가
아니라는 사례가 하나 더 늘었다.

## INFO

14건 전부 미조치. 리뷰가 "설계상 수용 가능 / 좋은 설계 판단 / 우선순위 낮음 / 확인 목적"
으로 판정한 것들이다.

> **⚠️ 정정 (3라운드, 2026-09-01).** 이 문단은 원래 가드의 세 경계(메서드 이름 기반 탐지 ·
> 화살표 함수 필드 미인식 · `startsWith` 접두 비교)가 **"가드 헤더에 트레이드오프로 이미
> 적혀 있다"** 고 적었다. **거짓이었다.** 3라운드 리뷰가 가드·fixture·spec 세 파일을
> `화살표|arrow|트레이드오프|한계|제약` 로 grep 해 **0건**임을 보였고, 나도 같은 grep 으로
> 확인했다. 그런 문서화는 존재한 적이 없다.
>
> 더 나쁜 것은 **그 거짓 문장을 조치하지 않을 근거로 썼다**는 점이다. 화살표 함수 필드
> 형태는 실측상 탐지 **0건**이었고(직접 프로브), 즉 이 PR 이 막으려는 결함이 문법만 바꾸면
> 그대로 재도입될 수 있었다. 3라운드에서 가드에 `PropertyDeclaration` + 화살표 분기를
> 추가하고 fixture 로 고정했다.

## 뮤테이션 5축 (예측 / 실측)

```
X1 카운터 이름 오탈자                    RED / RED 2
X2 라벨 키 변경 (resource_type → resource) RED / RED 2
X3 클램핑 제거                           RED / RED 1
X4 상한 64 → 128 (공유 상수가 실제로 쓰이나) RED / RED 1
X5 관측 호출의 try 제거                  GREEN → 축 추가 후 RED 1
```

X5 는 **예측을 GREEN 으로 적고 시작해** 그 예측이 맞았다 — 계약의 핵심이라 축을 채웠다.

## 검증

lint(`--max-warnings 0`) · prettier · backend **442 suites / 9202 passed, 1 skipped** ·
docs 가드 · e2e.
