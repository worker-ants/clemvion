# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat` (재검토, 델타=`9416da806`)

## 검토 범위

이번 델타는 `codebase/channel-web-chat/src/widget/use-widget.test.ts` 주석 1줄 정정
(`direct-load 외부 입력 방어` → `direct-load 전용 방어가 아니다: 이 경로는 정상 임베드에서도
발동한다(4-security.md §1)`) + `plan/complete/webchat-boot-apibase-scheme-validation.md` 회고
절 추가(spec 본문 변경 없음). 직전 라운드 지적대로, 이번엔 **문자열이 아니라 뜻**으로 다음
세 가지를 확인했다.

## 확인 1 — "쿼리/직접 로드 경로는 개발·샘플·데모 전용" 취지의 잔존 서술

`spec/7-channel-web-chat/*.md` 6개 문서 + `codebase/channel-web-chat/src/**` +
`codebase/packages/web-chat-sdk/src/**` 전체를 표현이 아니라 취지로 훑었다.

- `4-security.md §1`(`apiBase` 입력 검증 행)이 이 취지를 **명시적으로 부정**하는 SoT다:
  "쿼리 경로를 'host 없는 직접 로드/샘플 전용' 으로 읽으면 안 된다 — 그렇게 읽고 제거하면
  모든 정상 임베드의 부트스트랩이 깨진다."
- 코드 쪽 3곳(`use-widget.ts:222` JSDoc, `use-widget.ts:1384` 인라인 주석,
  `use-widget.test.ts:15` describe 주석)이 모두 이번 라운드까지 정정 완료되어 §1 과 같은
  결론("전용이 아니다")을 명시 인용(`4-security.md §1`)으로 서술한다. 세 곳 모두 재확인함.
- `_product-overview.md §3 사용 시나리오` 표의 "데모/문서용 임베드 예제 | 샘플 | 위 표면
  시연 static 데모" 행과 `§4` 구성요소 표의 "C 샘플" 행은 **SDK `examples/` 자체가 데모
  용도라는 것**을 말할 뿐, "쿼리/직접 로드 *경로*가 샘플 전용" 이라는 주장이 아니다 — 대상이
  다르다(패키지 vs 코드 경로). 오독 소지 낮음, 취지 충돌 아님.
- `5-admin-console.md §6.1` 의 "위젯 dev 데모 host(`demo-host.tsx`)와 동일 경로" 서술도
  마찬가지로 "이 경로(iframe src query→`wc:boot`)를 데모 host 도 함께 쓴다"는 사실 진술이지,
  "이 경로가 데모 전용" 이라는 배타적 주장이 아니다. 오히려 아래 확인 2 참고.
- `3-auth-session.md §R8` 의 "동명 함수 주의: 데모 설정에는 후행 `/api` 까지 제거하는
  정반대 계약의 동명 정규화 함수가 있다" 는 **다른 대상**(trailing-slash 정규화 함수의 이름
  충돌 경고)이라 이 취지와 무관.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:4248` 의 "같은
  파일의 '호스트 없이 직접 로드' 폴백" 은 테스트 케이스 설계 근거 설명 중 코드 경로를
  가리키는 인용일 뿐, 그 경로가 "전용"이라는 주장을 하지 않는다(오히려 그 폴백이 host 유무를
  검사하지 않는다는 사실을 근거로 든다 — §1 취지와 정합).

추가 잔존 발견 없음.

## 확인 2 — `5-admin-console.md §6.1` 과 `4-security.md §1` 의 상호 일관성

`§6.1` 은 운영 콘솔 라이브 미리보기가 iframe `src` 를
`<widgetBase>/web-chat/v1/app/?apiBase=<api-base>&trigger=<endpointPath>&locale=<locale>` 로
구성해 **query param 을 1차 boot 경로로 삼고**, 이어 `wc:ready` → `wc:boot` 으로 전체 config
를 재전송한다고 서술한다. 이는 §1 이 말하는 "쿼리 경로는 host 있는 정상 임베드에서도
발동한다"는 주장의 **실제 소비자 사례**(host=콘솔이 존재하는데도 쿼리를 1차로 쓰는 경우)이며,
두 문서는 서로를 반증하지 않고 오히려 상호 보강한다. 모순 없음.

## 확인 3 — 새 테스트 주석과 `§1` 의 정합

`use-widget.test.ts:15` (커밋 `9416da806`)의 새 주석 —

```
// 쿼리 apiBase 하드닝 — http(s) 스킴만 허용. **direct-load 전용 방어가 아니다**: 이 경로는
// 정상 임베드에서도 발동한다(`4-security.md §1`).
```

은 §1 본문의 문장과 **주장·인용 대상 모두 일치**한다. 인용된 `4-security.md §R7`(`use-widget.ts`
JSDoc 쪽)도 확인 결과 실재하며(`4-security.md:272` "`apiBase` 스킴 검증을 두 경로 모두에
거는 이유"), 내용도 같은 결론(비대칭 검증 철회 근거)이라 dangling reference 아님. 모순 없음.

## 발견사항

없음. (억지 발견 없음 — 위 세 확인 모두 spec-code-test 삼자가 같은 취지로 수렴함을 재확인했다.)

## 요약

이번 델타(주석 1줄 + plan 회고)는 spec 본문을 건드리지 않았고, 그 1줄이 정정하려던 취지
("쿼리/직접 로드 경로는 host 없는 샘플·개발 전용이 아니다")는 `4-security.md §1`(SoT)·
`5-admin-console.md §6.1`(실사용 사례)·코드 3곳(JSDoc·인라인 주석·이번에 고친 테스트 주석)
전체가 문자열이 아니라 의미 수준에서 일관되게 정렬돼 있다. 표현이 다른 잔존 복제본(직전
라운드가 놓쳤던 종류)을 spec·코드 전수로 재탐색했으나 추가 발견은 없었다. Cross-spec
관점에서 이 영역은 현재 안정 상태다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
