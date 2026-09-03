# RESOLUTION — entity nullable 배치 2 리뷰

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **4** · INFO 13

**WARNING 4건 전부 조치.** 넷 중 셋이 **내 서술의 진위**이고, 하나는 **내 분석이 틀린** 것이었다.

## W1 — 넓히지도 않은 컬럼을 넓혔다고 썼다

`NodeExecution.inputData`/`outputData`/`error` **세 컬럼**을 넓혔다고 적었는데, 실제로는
**두 컬럼**(`outputData`·`error`)뿐이다. `inputData` 는 `default: {}` 이고 **`nullable: true` 가
아예 없어** 애초에 대상이 아니었다.

AST 스캔은 `nullable: true` 만 고르므로 **옳았고 내 서술만 틀렸다.** 공교롭게도 원래
docstring 이 *"**두** 컬럼"* 이라 적고 있어 대조하면 바로 드러나는 자리였다 — 내가 고치던 그
문장이 정답을 들고 있었는데 안 봤다.

plan 과 **커밋 메시지**(미푸시라 `--amend`) 양쪽을 정정했다.

## W4 — 내 분석이 틀렸고 reviewer 가 맞았다

reviewer 가 *"`redact-stored-error.spec.ts:305` 의 이중 캐스트가 이제 불필요"* 라고 했다.
내 분석으로는 **틀린 것 같았다** — `inputData` 는 여전히 non-null 이고 `undefined` 분기도 있으니
캐스트가 필요해 보였다.

**돌려 봤더니 캐스트 제거 후 `tsc` 오류 0.** 이유는 내가 생각한 축이 아니었다:

```ts
const row = (over: Record<string, unknown> = {}) => ({ ... });
```

`row` 의 파라미터가 이미 `Record<string, unknown>` 이라 **이 자리에서 컬럼 타입이 강제된 적이
없다.** 캐스트는 넓히기 전에도 불필요했다.

> **분석으로 다투지 않고 돌려 본 것이 맞았다.** 주석이 설명하던 제약(`row` 가 컬럼 타입을
> 강제한다)은 실재하지 않았다.

캐스트를 제거하고 주석을 **두 축으로** 정정했다 — (1) 캐스트는 애초에 불필요했다, (2) 이제
`outputData`/`error` 는 정적으로도 `null` 이 온다. 원문은 취소선으로 보존했다.
`undefined` 분기가 여전히 정적으로 도달 불가라는 원래 취지는 그쪽에 남겨 뒀다.

## W2·W3 — 내가 만든 문서 구조 결함

- **W2** 새 H2(`## 배치 2`)를 만들면서 체크박스가 두 헤딩으로 흩어졌다. `## 할 일` 상단에
  "배치별 체크박스는 각 배치 절에 있다" 는 안내를 넣어 역할을 갈랐다.
- **W3** `(d) Schedule.lastRunAt` 이 **"완료"와 "미해결 후보" 양쪽에** 있었다 — 배치 3 착수자가
  재작업 대상으로 오인한다. 후보 목록 쪽을 취소선 처리하고 해소 위치를 가리켰다.

## 미조치 (판단 유지)

- **INFO#2** 하류 null-역참조 확대 가능성 — `tsc` 가 비-spec 소스 **0건**이므로 정적으로는
  새 위반이 없다. reviewer 도 "범위 밖" 으로 적었다.
- **INFO#3** relation 의 `undefined`(미-join) 경로는 `| null` 로 표현 못 한다 — 맞는 지적이나
  **이 diff 의 회귀가 아니라 개선**이고, relation `| null` 관례는 실측으로 확정했다(기존 6건).
- **INFO#8** 새 헤딩 앞 빈 줄 — ~~W2 정정에 포함됐다.~~ **거짓이었다** (다음 라운드 W1,
  reviewer 3명 중복 발견). W2 편집은 `## 할 일` 아래에 안내를 넣었을 뿐 그 헤딩 줄을
  **건드린 적이 없고** 빈 줄은 그대로 없었다(`git show` 로 확인). 확인 없이 "포함됐다" 를
  썼다 — 다음 라운드에서 실제로 삽입했다.
- **INFO#11** TypeORM nullable 2단계 규약의 `spec/conventions/` 정식화 — **배치 3 완료 시점**이
  맞다. 지금 올리면 아직 열린 축(6파일)이 규약을 뒤흔들 수 있다.
- **INFO#13** reviewer 가 e2e 를 재실행하지 않았다는 caveat — 나는 실행했다(**292 passed**,
  부팅 확인). 커밋 메시지의 주장은 실측이다.

## 검증

lint · unit(backend **9,250**) · build · e2e(**292**, 부팅 확인) **PASS** ·
backend ratchet **198/37** · `tsc` 비-spec 소스 오류 **0** · 가드 **12/12** ·
`redact-stored-error` **34/34**.
