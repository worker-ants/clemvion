# 정식 규약 준수 검토 — `spec-draft-chat-channel-patch-token.md` (2라운드)

검토 대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md`
검토 모드: `--spec` (draft), 2라운드 — 오케스트레이터가 지정한 좁은 초점 5가지에 한정.
1라운드(`20_13_39`)의 CRITICAL(`R-CC-17` 점유 충돌)과 W1(형제 필드 관측 반전)·INFO(원시 줄번호·
D-2 서술 순서)는 draft 가 이미 처분했고, 본 라운드에서 재지적하지 않는다.

## 0. 재검증 방법

- `spec/5-system/15-chat-channel.md` 의 실제 `### R-CC-N` 헤더를 전수 grep.
- `git log --all -S"R-CC-14" -- spec/5-system/15-chat-channel.md` 로 draft 가 인용한 결번 근거
  (`f4640ff2d`→`841d6cfb8`)를 직접 재현.
- `origin/main` 대비 현재 worktree HEAD(`d93e8511d`)의 drift 를 확인(병렬 세션 충돌 가능성 배제).
- `spec/conventions/error-codes.md`(§5 Retired codes)와 `spec/5-system/3-error-handling.md`(§2.1)를
  대조해 "결번 재사용 금지"·"미확정 항목의 유예 표기" 선례 유무를 확인.
- `spec/5-system/15-chat-channel.md`(§5.4.1/§5.4.1.1)의 실제 표 구조·기존 인라인 정정 문구를 재확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 CRITICAL 항목 원문을 대조.

## 발견사항

- **[INFO]** 변경안 C — §5.4.1.1 표에서 "수정 대상 행"과 "신규 행" 여부를 명시하지 않음
  - target 위치: `## 변경안` 목록의 "C. §5.4.1.1 표" 항목
  - 위반 규약: 없음(형식 규정을 어긴 것은 아님) — 다만 같은 목록의 "A. §5.4.1 표" 항목은
    *"3행의 차단 대상을 …로"* (기존 행 수정) + *"별 행으로 세워"* (신규 행 추가) 를 명확히
    구분해 적은 반면, C 는 *"inboundSigningPlaintext 도 PATCH 에서 차단"* 이라고만 적어 이것이
    기존 "회전(rotation)" 행(이미 `v1 미정의 — 차단` 을 선언 중, `15-chat-channel.md:390`)의
    문면을 구현과 재정합시키는 정정인지, 별도 신규 행 추가인지 구분되지 않는다.
  - 상세: `cross_spec` 2라운드가 이미 실측했듯(§5.4.1.1의 3행이 "v1 차단"을 이미 선언 중이라
    변경안 C는 v2 후보 결정에 손대지 않고 표 문면을 구현과 재정합시키는 정정) 내용 자체는
    문제가 없다. 다만 A 와 동일한 "수정 vs 신설" 구분 표기를 C 에도 적용하면, "적용" 단계에서
    실제 표 편집자가 기존 3행을 손대는 대신 실수로 중복 행을 추가할 여지가 줄어든다.
  - 제안: C 항목을 "기존 3행('회전')의 메커니즘 문면을 구현과 재정합" 형태로 한 문장 명확화.
    (BLOCK 사유 아님 — 문서 완성도 제안.)

- **[INFO]** D-1 의 `details.field` 유예 — 허용되나, 실제 표 반영 시 형식 공백 처리 방식을 미리
  못박아 두면 안전
  - target 위치: `### D-1` 하단 인용 문단(*"`details.field` 형태는 이 턴에서 규정하지 않는다"*)
  - 관련 규약: `spec/5-system/3-error-handling.md §2.1`(에러 봉투 형식) — 이 문서는 세부 shape
    가 아직 미구현인 항목("사용자향 한국어 메시지·세분화 코드")을 **"계획(Planned)"** 이라고
    명시적으로 표기해 두는 선례가 있다. 다만 그 선례는 "현재 실제 동작"(고정 문자열·단일 코드·
    중첩 경로)은 확정 서술하고 **미래 개선분만** 유예하는 형태다 — D-1 은 "현재 값 자체"를
    통째로 미확정으로 남긴다는 점에서 더 강한 유예다.
  - 상세: `cross_spec` 2라운드가 `3-error-handling.md §1.3`은 `details` 세부 shape 를 규정하지
    않아 D-1 이 어떤 표기를 택하든 직접 모순이 없다고 확인했고, 필드 경로 표기 정확성 자체는
    1라운드 W1대로 이미 후속(e2e 실측) 대기로 처분돼 본 라운드 재지적 대상이 아니다. 그 판단에
    동의한다. 다만 §5.4.1/§5.4.1.1 표의 **기존 모든 행**(`botTokenRef`·`inboundSigningPlaintext`·
    `inboundSigning`)은 예외 없이 `details.field='X'` 구체값을 명시하는 형식을 쓰고 있다
    (`15-chat-channel.md:376`·`:390`). 변경안 A/C 가 실제로 표 행을 작성하는 "적용" 단계에서
    `details.field` 칸을 완전히 빈칸으로 두면, 같은 표 안에서 유일하게 그 칸이 없는 행이 되어
    §2.1 이 세운 봉투 형식의 완결성 기대(모든 VALIDATION_ERROR 행이 `details.field` 값을
    갖는다)에서 이탈한다.
  - 제안: 결정 자체(유예)는 규약상 문제 없음. 다만 "적용" 단계에서 표 행을 쓸 때 `§2.1`의
    "계획(Planned)" 표기 선례를 따라 `details.field` 칸에 명시적 placeholder(예: *"미확정 —
    후속 e2e 확인 대기"*)를 남기도록, 후속 항목 1에 그 문구를 미리 못박아 두면 다음 사람이
    조용한 공백과 의도된 유예를 혼동하지 않는다.

- **[INFO]** 후속 항목 5 — 대상 트래커 파일 경로가 항목 자체에 인라인돼 있지 않음
  - target 위치: `## 후속으로 등재할 것` 5번(*"트래커의 두 CRITICAL 처방문을 D-1/D-2/D-3 로
    갱신…"*)
  - 상세: "트래커"가 어느 파일인지는 draft 최상단 `> 출처: spec-draft-nullable-notation-followups.md`
    줄에서만 유추 가능하다. 실측 결과 그 파일의 CRITICAL 항목(`plan/in-progress/spec-draft-
    nullable-notation-followups.md:1894` 부근)은 현재도 처방문에 *"PATCH 전용
    ChatChannelConfigDto 변형(`botToken` 제외)"* 이라는, 이 draft 가 명시적으로 "그것만 하면
    지금보다 나빠진다"고 반증한 처방을 그대로 담고 있다 — 갱신 필요성 자체는 실재하고 정확하다.
    다만 "적용" 단계 실행자가 항목 5만 보고 파일을 못 찾을 위험을 없애려면 경로를 인라인하는
    편이 안전하다(직전 라운드 finding #7 — "등재한다고 선언만 하고 등재 안 했다"가 이미 두 번
    재발한 이력이 있는 영역).
  - 제안: 항목 5에 `plan/in-progress/spec-draft-nullable-notation-followups.md` 경로를 인라인.

## targeted 질문에 대한 결론

1. **`R-CC-21` 채번**: 맞다. `spec/5-system/15-chat-channel.md`의 실제 `### R-CC-N` 시퀀스는
   `10, 11, 12, 13, 15, 16, 17, 18, 19, 20`이고 최댓값은 20 — `21`이 다음 미사용 번호다.
   `14`의 결번 근거(`f4640ff2d`가 도입, `841d6cfb8`이 *"의사결정 과정·시간·review/plan 참조
   제거"*로 의도적으로 철회)를 `git log -S`로 직접 재현해 draft의 인용과 정확히 일치함을
   확인했다. `spec/conventions/error-codes.md §5`(Retired codes — 은퇴된 코드는 새 의미로
   재사용하지 않고 이력만 남긴다)와 같은 정신의 선례가 이 저장소에 이미 있어, 결번을 채우지
   않고 max+1을 쓰는 이번 판단은 국지적 관례("Rationale ID 컨벤션" 자체는 결번 재사용 여부를
   명시하지 않는다)를 넘어 저장소 전반의 식별자 은퇴 관례와도 정합적이다. `R-CC-21`은
   `spec/`·`plan/`·`codebase/` 전수에서 미사용(다른 진행 중 chat-channel 플랜에도 선점 없음),
   `origin/main`도 이 worktree 기준(`d93e8511d`)과 동일해 병렬 세션 충돌도 없다.
2. **변경안 C의 §5.4.1.1 표 행 추가/수정 형식**: 그 절의 관례와 맞는다. §5.4.1·§5.4.1.1 모두
   "시점/메커니즘/비고" 3행 lifecycle 표 구조를 이미 공유하며, 변경안 A가 같은 패턴으로 §5.4.1
   표를 수정/추가하는 것과 대칭이다. 다만 C의 문구가 "기존 행 수정"인지 "신규 행 추가"인지
   불명확한 점은 위 INFO 참고.
3. **D-1의 필드 경로 유예**: 규약상 허용된다. `3-error-handling.md §2.1`에 미구현 항목을
   "계획(Planned)"으로 명시 유예하는 선례가 있고, `cross_spec`이 확인했듯 `3-error-handling.md
   §1.3`은 `details` 세부 shape를 규정하지 않아 D-1의 유예와 직접 충돌하는 지점이 없다. 다만
   §5.4.1/§5.4.1.1의 기존 행 전부가 `details.field` 구체값을 명시하는 형식이라, "적용" 단계에서
   완전한 공백이 아니라 §2.1 선례를 따른 명시적 placeholder로 남기길 권한다(위 INFO).
4. **후속 5건의 등재 가능성**: 5건 모두 구체적 파일·함수·표 위치를 지목하고 있어 "적용" 단계에서
   기계적으로 실행 가능한 수준이다. 실제 `plan/in-progress/spec-draft-nullable-notation-
   followups.md`의 두 CRITICAL 처방문을 확인한 결과 갱신 필요성 자체도 실재한다(현재 처방문이
   draft가 반증한 위험한 안을 그대로 담고 있음). 유일한 개선 여지는 항목 5의 파일 경로 인라인
   (위 INFO).
5. 1라운드에서 이미 처분된 항목(원시 줄번호, D-2 관측 계약 서술 순서, R-CC-17 충돌 그 자체)은
   재지적하지 않았다.

## 요약

정식 규약 준수 관점에서 이번 라운드는 CRITICAL/WARNING이 없다. `R-CC-21` 채번은 실제
`R-CC-N` 시퀀스·`git log -S` 결번 근거·저장소 전반의 "은퇴 식별자 재사용 금지" 관례(error-codes.md
§5) 모두와 정합하며 재검증 결과 이상 없다. 변경안 C의 표 편집 형식은 §5.4.1/§5.4.1.1의 기존
3행 lifecycle 표 구조를 그대로 따르는 것이라 그 절의 관례에 부합한다. D-1의 `details.field`
유예는 `3-error-handling.md §2.1`의 "계획(Planned)" 표기 선례로 규약상 허용되며, `cross_spec`이
확인한 대로 `error-handling.md`와 직접 충돌하지도 않는다 — 다만 실제 표 행을 쓰는 "적용" 단계에서
완전한 공백 대신 명시적 placeholder를 쓰도록 지금 못박아 두는 편이 안전하다. 후속 5건은 실행
가능한 구체성을 갖췄고, 그중 트래커 갱신 필요성은 실측으로도 확인된다. 나머지는 문서 완성도
수준의 INFO 3건뿐이며 어느 것도 이 draft의 `spec/` 반영을 막을 사유가 아니다.

## 위험도

NONE

STATUS: success
