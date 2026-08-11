# Rationale 연속성 검토 — webchat apiBase scheme (df1375208)

## 검토 대상

커밋 `df1375208`(`fix(webchat): spec 은 "샘플 전용으로 읽지 마라" 고 쓰고, 코드 주석은 "샘플" 이라 했다`) —
`codebase/channel-web-chat/src/widget/use-widget.ts` 주석 2곳 교체. 실행 코드 변경 0줄(diff stat: `1 file
changed, 10 insertions(+), 2 deletions(-)`, 전부 주석). spec 변경 없음.

교체된 두 주석:
1. `configFromQuery` 함수 JSDoc — `boot config 를 query param 으로 폴백 해석(host 없이 직접 로드/샘플
   대비).` → `"샘플/개발 전용" 이 아니다. SDK 의 resolveIframeTarget 이 정상 임베드에서도 같은 apiBase 를
   iframe src 쿼리에 싣으므로 이 경로는 모든 임베드에서 발동한다 ... SoT: 4-security.md §1.`
2. 마운트 `useEffect` 내 직접 로드 폴백 호출부 인라인 주석 — `// host 없이 직접 로드(샘플/개발): query
   param 만으로도 부팅 시도.` → `// query param 만으로 부팅 시도 — host 유무를 검사하지 않는다. ...
   "샘플 전용" 으로 읽고 지우면 전부 깨진다.`

## 실측 절차와 근거

**1. #384 원 결정의 무근거 번복 여부 — `git log -S` 실측**

```
git log --all --oneline -S"host 없이 직접 로드" -- codebase/channel-web-chat/src/widget/use-widget.ts
df1375208 fix(webchat): spec 은 "샘플 전용으로 읽지 마라" 고 쓰고, 코드 주석은 "샘플" 이라 했다
a652f8733 feat(channel-web-chat): 임베드형 웹채팅 위젯 + SDK + 경로-스코프 CORS (#384)
```

이 문자열을 건드린 커밋은 이 둘뿐이다 — 도입(#384)과 이번 정정(df1375208) 사이에 그 서술을 바꾼 커밋은
없다(즉 "당시엔 맞았는데 이후 SDK 변경으로 낡았다" 는 시나리오가 성립하려면 중간에 SDK 쪽 변경 커밋이
있어야 하는데, 없다).

`resolveIframeTarget`(apiBase 를 iframe src 쿼리에 싣는 SDK 함수)의 도입 시점도 확인:

```
git log --all --oneline -S"resolveIframeTarget" -- codebase/packages/web-chat-sdk/src/bridge.ts
a652f8733 feat(channel-web-chat): 임베드형 웹채팅 위젯 + SDK + 경로-스코프 CORS (#384)
```

**`resolveIframeTarget` 도 같은 #384 커밋에서 도입됐다** — 즉 "위젯 측 주석이 쓰였을 때는 SDK 가 아직
쿼리에 apiBase 를 안 실었는데 이후 SDK 가 바뀌어 주석이 낡았다" 는 가설은 반증된다. 두 코드(위젯의
`configFromQuery` 주석 + SDK 의 `resolveIframeTarget`)는 **같은 PR 에서 함께 태어났다.**

추가로 #384 시점의 실제 마운트 `useEffect` 코드(`git show a652f8733:.../use-widget.ts`)를 확인하면, 쿼리
폴백(`fallback`)은 **host 유무를 검사하는 조건문 없이 무조건 시도**된다 — 지금과 동일한 무조건 발동
구조다. 즉 기능(코드) 은 처음부터 지금까지 "host 없이 직접 로드" 상황으로 제한된 적이 없고, **주석만
그렇게 읽히도록 잘못 쓰여 있었다.**

⇒ **결론: 번복이 아니다.** #384 는 "쿼리 폴백은 host-less 전용" 이라는 설계 결정을 내린 적이 없다(코드가
처음부터 그 결정을 구현하지 않았다). df1375208 은 실제 결정을 뒤집은 것이 아니라, PR #384 자체 내부에서
서로 어긋나 있던 주석(위젯측)과 구현(SDK 측 `resolveIframeTarget`)의 **불일치를 사후에 바로잡은 것**이다.
기각된 대안의 재도입도, 합의 원칙 위반도 아니다.

**2. §R7·§1·새 주석의 상호 일관성**

- `4-security.md §1` (표 행 "`apiBase` 입력 검증"): "쿼리 경로를 host 없는 직접 로드/샘플 전용 으로
  읽으면 안 된다 — 그렇게 읽고 제거하면 모든 정상 임베드의 부트스트랩이 깨진다(ai-review `15_50_56`
  cross_spec)."
- `4-security.md §R7`("`apiBase` 스킴 검증을 두 경로 모두에 거는 이유", 2026-08-11 — 오늘 날짜, 같은
  작업 라운드): "SDK 는 같은 값을 양쪽으로 보낸다. `resolveIframeTarget`(`web-chat-sdk/src/bridge.ts`)이
  apiBase 를 iframe src 쿼리에 싣고, `boot()`(`web-chat-sdk/src/index.ts`)이 같은 값을 `wc:boot` 으로도
  보낸다."
- 새 코드 주석(위 1·2): "정상 임베드에서도 SDK 가 iframe src 쿼리에 같은 값을 실으므로 여기서 먼저 뜨고,
  뒤이어 도착하는 `wc:boot` 이 세대 판정으로 대체한다. SoT: `4-security.md §1`."

세 서술이 동일한 사실(쿼리 경로는 host 유무와 무관하게 모든 정상 임베드에서 발동)을 가리키고, 코드 주석이
spec 을 SoT 로 명시적으로 인용한다. 모순 없음. `use-widget.ts` 의 `safeApiBase` JSDoc(이 커밋 이전 라운드
에서 이미 갱신됨)도 "정정 이력은 `4-security.md` §R7 참고(같은 서술을 여기 되풀이하지 않는다)" 로 SoT 를
한 곳(spec)에만 두고 있어 향후 drift 위험도 낮다.

**3. 새 Rationale 동반 여부**

엄밀히는 "번복"이 아니므로 새 Rationale 이 필수는 아니지만, 실제로 이 교정의 근거는 이미 같은 PR 의
`4-security.md §R7`(오늘 날짜)에 상세 기록돼 있고 코드 주석이 그걸 명시 인용한다 — 결정 근거 문서화
관행은 오히려 모범적으로 지켜졌다.

## 발견사항

- **[INFO]** "direct-load 전용" 프레이밍의 잔존 흔적 (df1375208 스코프 밖, 완전성 갭)
  - target 위치: 이번 커밋(df1375208) 자체가 아니라 그 주변 코드 — `codebase/channel-web-chat/src/widget/use-widget.test.ts:15`
    (`// 쿼리 apiBase 하드닝 — http(s) 스킴만 허용(direct-load 외부 입력 방어).`)
  - 과거 결정 출처: `spec/7-channel-web-chat/4-security.md §1`(오늘 갱신된 "host 없는 직접 로드/샘플
    전용으로 읽으면 안 된다" 정정) 및 df1375208 커밋 메시지의 "grep 으로 복제본이 정확히 2곳임을 확인"
  - 상세: df1375208 이 프로덕션 코드(`use-widget.ts`) 2곳의 "host 없이 직접 로드/샘플" 프레이밍은
    바로잡았지만, 같은 취지의 서술이 테스트 파일에 다른 문구(`direct-load 외부 입력 방어`)로 남아 있다
    (커밋이 검색한 정확 문자열과 달라 grep 에 안 걸린 것으로 보임). `use-widget-eager-start.test.ts:4248`
    의 `"host 없이 직접 로드"` 폴백 이라는 인용도 동일 계열이나, 이쪽은 코드 경로를 가리키는 인용부호 붙은
    라벨이라 "전용" 주장은 하지 않아 위험도가 더 낮다. `api-base.ts:5` 의 `direct-load 쿼리 하드닝` 참조도
    같은 계열(기능의 옛 별칭)이나 배타성 주장은 없다. 기능·spec·핵심 프로덕션 주석은 이미 일관되므로
    Rationale 위반은 아니지만, "쿼리 경로 = direct-load 전용" 오독을 재유발할 잔여 표면이다.
  - 제안: 후속 정리(같은 PR 또는 별도 후속 커밋)에서 `use-widget.test.ts:15` 주석도 "두 경로 모두에서
    발동" 취지로 맞추면 §1 의 우려("그렇게 읽고 제거하면 모든 정상 임베드의 부트스트랩이 깨진다")가
    코드베이스 전체에서 완전히 해소된다. 차단 사유는 아니다.

## 요약

이번 델타(df1375208)는 spec 변경 없이 코드 주석 2줄만 교체했다. `git log -S` 로 원 출처를 추적한 결과,
문제의 주석("host 없이 직접 로드/샘플 대비")과 그것을 실질적으로 반증하는 SDK 함수(`resolveIframeTarget`,
apiBase 를 iframe src 쿼리에 싣는 기능)가 **같은 PR(#384)에서 함께 도입**됐고, 그 사이 어떤 커밋도 이
서술을 바꾸지 않았다. 당시 코드(쿼리 폴백)도 host 유무를 조건으로 삼지 않고 처음부터 무조건 발동했으므로,
주석은 처음부터 실제 동작을 정확히 기술하지 못했던 것이지 이후 SDK 변경으로 낡은 것이 아니다. 따라서
이번 수정은 #384 의 설계 결정을 뒤집거나 기각된 대안을 재도입한 것이 아니라, PR 내부에 있던 주석-구현
불일치를 사후 정정한 것이다. `4-security.md §1`·`§R7`(오늘 작성)과 새 코드 주석은 서로 같은 사실을
일관되게 서술하며, 코드 주석이 spec 을 SoT 로 명시 인용해 향후 drift 도 낮췄다. 유일한 잔여 사항은
테스트 파일 한 곳에 남은 유사 프레이밍(INFO, 비차단)이다.

## 위험도

LOW

---

BLOCK: NO
STATUS: OK
