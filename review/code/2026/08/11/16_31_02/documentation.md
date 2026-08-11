# 문서화(Documentation) Review — webchat apiBase scheme (델타 `9416da806`)

대상: `codebase/channel-web-chat/src/widget/use-widget.test.ts:15-16`(주석 1줄 정정) +
`plan/complete/webchat-boot-apibase-scheme-validation.md`(라운드 2~5 회고 절 신설).

이번 라운드의 요청은 세 가지였다: (1) "쿼리/direct-load 경로는 개발·샘플 전용" 이라는 **취지**의
서술이 `codebase/`·`spec/` 어딘가에 문자열이 아니라 **뜻으로** 더 남아 있는지, (2) 새 테스트 주석과
`spec §1` 이 모순되지 않는지, (3) plan 에 추가된 회고 절(라운드 1~5 표, "#384 유래", "다섯 번")의
사실 주장이 맞는지. 아래는 각각 실측 결과다.

## 1. 취지 기준 재검색 — 네 번째 복제본은 없다

`direct-load`, `직접 로드`, `샘플`, `개발용`, `dev`, `standalone`, `host 없이`, `호스트 없이`,
`데모`, `demo`, `local`, `전용` 을 `codebase/channel-web-chat`·`codebase/packages/web-chat-sdk`·
`spec/7-channel-web-chat` 전역에서 훑어 각 매치의 **본문을 읽고** 배타성 주장 여부를 판정했다.

- `use-widget.ts:222`(`configFromQuery` JSDoc) — `**"샘플/개발 전용" 이 아니다.**` 이미 정정됨(라운드 4).
- `use-widget.ts:1382-1384`(마운트 `useEffect` 폴백 호출부) — `"샘플 전용" 으로 읽고 지우면 전부
  깨진다.` 이미 정정됨(라운드 4).
- `use-widget.test.ts:15-16` — 이번 델타로 정정됨. `spec §1` 을 SoT 로 명시 인용.
- `spec/7-channel-web-chat/4-security.md:39` §1 — `"host 없는 직접 로드/샘플 전용" 으로 읽으면
  안 된다` 로 이미 정정(라운드 3 cross_spec).
- `use-widget-eager-start.test.ts:4248` `"host 없이 직접 로드" 폴백` — **배타성 주장이 아니다.**
  `mergeBootConfig` 의 `??` 폴백이 유일 공급원이 되도록 쿼리에서 `trigger` 를 뺀 이유를 설명하는
  문맥이고, 이어지는 문장이 "boot 과 **무관하게** 쿼리만으로 부팅해 버려" 라고 명시해 오히려 그
  경로가 host 유무와 상관없이 발동한다는 사실을 정확히 서술한다. 인용부호 붙은 코드-경로 라벨일
  뿐, "이 경로는 direct-load 에서만 쓰인다" 는 주장을 하지 않는다.
- `api-base.ts:5` `direct-load 쿼리 하드닝 참고` — 기능을 가리키는 옛 별칭 참조일 뿐, 배타성 주장
  없음(`apiBase` 경로 보존이 필요한 이유를 설명하는 문맥).
- `use-widget.ts:64`(`isEmbedAllowed` 의 `호스트 origin 미탐지(직접 로드 등) → soft 허용`),
  `use-widget.ts:1321`(헬퍼로 묶은 이유 설명 중 "직접 로드 폴백" 언급) — 둘 다 다른 함수(embed
  allowlist soft-check, catch 통합 헬퍼)를 설명하는 문맥이라 "쿼리 경로 = 샘플/개발 전용" 주장과
  무관.
- `README.md`/`demo-*.ts`/SDK `examples/README.md` 의 `demo`·`dev 전용` 매치는 전부 실제
  `/demo` 개발 호스트 라우트(별개 기능)를 가리킨다. apiBase 쿼리 폴백의 배타성과는 무관.

→ **세 번째 복제본(=이번 델타가 고친 `use-widget.test.ts:15`) 이후로 남은 네 번째 복제본은
찾지 못했다.** 억지로 만들지 않는다 — 없다.

## 2. 새 주석 vs `spec §1` — 모순 없음

`use-widget.test.ts:15-16`: `"direct-load 전용 방어가 아니다: 이 경로는 정상 임베드에서도
발동한다(4-security.md §1)."` vs `4-security.md:39`: `"쿼리 경로를 host 없는 직접 로드/샘플
전용으로 읽으면 안 된다 — 그렇게 읽고 제거하면 모든 정상 임베드의 부트스트랩이 깨진다."` —
같은 주장을 코드 주석이 spec 을 SoT 로 명시 인용하며 반복한다. 모순 없음.

## 3. plan 회고 절 사실 검증

라운드별 표(1~5) 각 행을 해당 라운드의 실제 산출물(RESOLUTION/SUMMARY/documentation.md 등)과
대조했다:

- **라운드 1** (`15_16_20`) "boot 검증 배선 / 헬퍼 단위 테스트 / 호출부" — 같은 plan 파일의
  "## 리뷰 라운드 1 이 잡은 것" 절(테스트 CRITICAL, 204건 전부 초록) 과 일치.
- **라운드 2** (`15_32_44`) "'applyConfig 가 자기 자리에서 실패한다'(거짓) / spec §R0 /
  safeApiBase JSDoc" — `review/code/2026/08/11/15_32_44/RESOLUTION.md`·`SUMMARY.md` 의
  "documentation CRITICAL — spec §R0 은 고치고 safeApiBase JSDoc 은 그대로" 와 일치.
- **라운드 3** (`15_50_53`) "§R0→§R7 재번호 / spec·plan / 같은 커밋이 새로 쓴 JSDoc(6명 수렴)" —
  `review/code/2026/08/11/15_50_53/SUMMARY.md` "**6명이 같은 자리를 짚었다** — scope ·
  rationale_continuity · naming_collision · convention · documentation · side_effect **여섯**"
  과 정확히 일치(6명 확인).
- **라운드 4** (`16_06_02`) "'쿼리 경로는 샘플 전용이 아니다' / spec §1 / 코드 주석 2곳" —
  `review/code/2026/08/11/16_06_02/SUMMARY.md` 의 security INFO("`use-widget.ts:1376` 주석이
  ... §1 에서 정정한 사실과 어긋난다 ... 복제본이 **2곳** ... 출처는 #384") 와 일치.
- **라운드 5** (`16_21_15`) "위와 같음 / 코드 주석 2곳 / 테스트 주석 1곳" —
  `review/consistency/2026/08/11/16_21_15/rationale_continuity.md` 의 INFO(`use-widget.test.ts:15`
  의 `direct-load 외부 입력 방어` 잔존, `git log -S`로 #384/`a652f8733` 출처 확정)와 일치.
- **"#384 유래"** — `git show --no-patch --format="%s" a652f8733` = `"feat(channel-web-chat):
  임베드형 웹채팅 위젯 + SDK + 경로-스코프 CORS (#384)"`. 커밋 메시지에 `#384` 가 실제로 포함돼
  있어 인용이 정확하다.
- **"grep 으로 복제본이 정확히 2곳" 이 틀렸다는 자기반성** — `rationale_continuity.md` 가 정확히
  이 사실을 지적한 문서이고, 표현("샘플" 문자열 vs 뜻)도 그 문서와 일치. 지어낸 서술 아님.

개별 행은 전부 실측과 부합했다. 다만 **표를 감싸는 절 제목·요약 문장 자체에 내부 불일치**가 있다.

## 발견사항

- **[WARNING]** 회고 절 제목 "라운드 2~5" 가 자신이 담은 표(라운드 **1**~5, 5행)·"다섯 번" 이라는
  카운트와 모순된다
  - 위치: `plan/complete/webchat-boot-apibase-scheme-validation.md:116` (`## 라운드 2~5 — 같은
    실패가 다섯 번 났다`), 표 본문 `:122-128`
  - 상세: 절 제목은 "라운드 **2~5**"(2,3,4,5 네 라운드)라고 범위를 명시하는데, 바로 아래 표는
    `1 (15_16_20)` 행부터 시작해 총 **5행**(1~5)을 담고 있고, 제목의 "다섯 번" 이라는 수는 그
    5행 전체를 센 값과만 맞아떨어진다("2~5" 만 세면 네 번이다). 118행의 "라운드 1 의 CRITICAL
    **이후** 이 PR 이 잡힌 것은 전부 한 형태다" 라는 문장도, 이어지는 표가 라운드 1 자체를 같은
    형태의 첫 행으로 포함시키는 것과 어긋난다. 즉 "제목 범위(2~5) vs 표 범위(1~5) vs 카운트(다섯
    번)" 세 표현이 서로를 반증한다 — 셋 중 하나만 맞을 수 있다(제목을 "라운드 1~5"로 고치거나,
    표에서 라운드 1 행을 빼고 "네 번"으로 고쳐야 한다).
  - 특기: 이 갭은 이 절 자신이 남기는 교훈("정정을 쓰는 순간 자매 자리를 **뜻**으로 전수 센다")과
    같은 종류의 실수(개수를 정확히 세지 못함)라 특히 눈에 띈다. 다만 커밋 메시지(`9416da806`)에도
    "라운드 2~5 회고 절 추가" 라는 같은 표현이 쓰여 있어, 단순 오탈자라기보다 저자가 처음부터
    "라운드 1은 이미 별도 절이 있으니 이 신설 절은 2~5만 다룬다" 는 의도였는데 표를 작성하며
    맥락(라운드 1)을 다시 끌어와 그 의도와 어긋난 것으로 보인다.
  - 기능/spec 영향 없음(plan 은 `status: complete`, 아카이브 성격). 차단 사유 아님.
  - 제안: 제목을 `## 라운드 1~5 — 같은 실패가 다섯 번 났다` 로 고치거나(표에 라운드 1 을 포함하는
    현재 구조를 살리는 쪽), 표에서 라운드 1 행을 제거하고 "라운드 1 은 앞 절에 이미 있다. 그 뒤
    같은 형태가 **네 번** 반복됐다" 로 조정한다. 다음에 이 문서를 편집할 기회에 얹으면 된다.

## 요약

이번 델타는 뜻 기준 재검색으로도 세 번째 복제본(`use-widget.test.ts:15`) 이후 네 번째 복제본을
찾지 못했다 — `direct-load`/`샘플`/`호스트 없이` 계열 표현이 남은 다른 자리(`use-widget-eager-start.test.ts:4248`,
`api-base.ts:5`, `use-widget.ts:64,1321`)는 전부 배타성 주장이 아닌 중립적 코드-경로 라벨/무관
문맥으로 확인됐다. 새 테스트 주석은 `spec §1` 과 모순되지 않는다. plan 회고 절의 개별 사실
주장(라운드별 표 각 행, `#384` 출처, `git log -S` 근거)은 관련 리뷰 산출물과 전부 부합해 지어낸
서술이 없었다. 유일한 문제는 그 회고 절 **자신의 제목·요약이 자기 표의 범위·카운트와 어긋난다**는
점(WARNING, non-blocking) — 정확히 이 절이 경계하려던 실수의 축소판이 절 제목 자체에 남았다.

## 위험도

LOW

STATUS: OK
