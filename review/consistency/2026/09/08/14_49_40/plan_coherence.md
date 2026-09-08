# Plan 정합성 검토 — target: `spec/5-system/` (--impl-done, diff-base=origin/main)

## 조사 방법

- `spec/5-system/**` 델타는 실측 0파일(정상 — 이 브랜치는 spec 을 바꾸지 않았다). 프롬프트가
  budget 컷으로 `<git diff … -- code_areas>` 를 통째로 생략했으므로, 실제 diff 는 워킹트리에서
  `git log --format='%h %ad %s' --date=format:'%H:%M:%S' origin/main..HEAD` 및 각 커밋의
  `git show <sha>` 로 직접 재구성했다. HEAD(`76bd51aab`, 14:49:30)는 4라운드 `/ai-review`
  (`review/code/2026/09/08/14_29_12`, Critical 0·Warning 3)의 fix 커밋이다.
- 이번 turn 이 실행 중인 자체 plan `plan/in-progress/spec-followups-batch-b.md` 와, 그 출처인
  `plan/in-progress/spec-draft-nullable-notation-followups.md`, 그리고 직전 라운드들이 접점으로
  지목해 온 `plan/in-progress/auth-guard-reflection-hardening.md` 를 디스크에서 전문 Read 했다.
- 직전 4회 plan_coherence 라운드(`12_21_11`·`13_22_38`·`13_34_30`·`14_01_57`·`14_29_13`)의
  기존 발견·정정 이력을 원문 대조로 재확인한 뒤, **이번 HEAD(76bd51aab)가 새로 만든 델타**에
  집중해 재검토했다(직전 라운드는 모두 그 이전 커밋 상태를 봤다 — `14_29_13`은 `ead63d797`
  시점, `76bd51aab`는 그 이후).

## 발견사항

- **[WARNING]** `76bd51aab`가 정정한 사실이 두 plan 문서의 "완료/종결" 서술을 반증했는데
  반영되지 않았다
  - target 위치: `codebase/backend/tsconfig.build.json` — `__test-utils__` exclude 세 번째
    항목의 주석(HEAD 기준 22~30행). 원래 사유("devDependency 를 끌어오지 않아 죽은 코드가
    번들에 실릴 뿐")를 `76bd51aab`(W3, `review/code/2026/09/08/14_29_12`)가 취소선 +
    정정했다 — *"같은 배치의 뒷 커밋이 `source-scan.ts` 에 AST 워커를 승격하며
    `import * as ts from 'typescript'`(devDependency)를 넣었다. 즉 이 축은 이제
    `repo-guards/**` 와 같은 등급의 devDependency 격리를 겸한다."*
  - 관련 plan:
    1. `plan/in-progress/auth-guard-reflection-hardening.md` 347~350행 — `d80583700`(HEAD
       이전 커밋, 14:01:44)이 써 넣은 "종결 (2026-09-08)" 각주가 *"이 항목의 트리거
       (devDependency import)는 **여전히 미충족**"* 이라고 단정한다.
    2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 594~596행(B-2 항목 본문,
       "완료(2026-09-08, 배치 B-2)" 각주가 602~607행에 있으나 본문 자체는 정정 안 됨) —
       *"지금은 지뢰가 아니다 … devDependency 지뢰는 없다. 죽은 코드가 dist 에 실릴 뿐이다."*
  - 상세: `git log -p`로 확인하면 `d80583700` 커밋 **한 커밋 안에서** (a) `source-scan.ts`에
    `import * as ts from 'typescript'`를 추가하고 (b) 그 직후 같은 커밋으로
    `auth-guard-reflection-hardening.md`에 "트리거는 미충족"이라는 각주를 써 넣었다 — 즉 그
    각주는 **작성되는 순간부터 자신이 속한 커밋에 의해 거짓**이었다. 이는 4라운드
    `/ai-review`(`14_29_12` W3)가 정확히 지적한 사실이고, 그 fix(`76bd51aab`)가
    `tsconfig.build.json`의 주석은 고쳤지만, **같은 거짓 전제를 담은 두 plan 문서 자리는
    고치지 않았다.** 특히 `spec-draft-nullable-notation-followups.md` 594~596행은 이번
    배치가 소유한 상위 트래커 원본이라 다음 세션이 "devDependency 트리거는 아직 안 왔다"고
    잘못 믿을 위험이 `auth-guard-reflection-hardening.md`보다 더 크다(그 문서가 B-1~B-8 항목의
    SoT이자 재개 판단 기준점이기 때문). 이 저장소가 이미 반복 학습한 클래스다 — "같은 문장이
    여러 자리에 있으면 한 곳만 고치면 drift 난다"(`#1112`/`#1113` 계보), 그리고 이번
    `76bd51aab` 커밋 메시지 자신도 "내 주석의 전제를 내 다음 커밋이 반증했다"는 같은 원리로
    스스로를 진단했으면서 정작 그 진단을 코드 주석 한 곳에만 적용했다.
  - 실질 영향: 두 plan 의 **결론**(exclude 를 이미 추가했고 남은 작업 없음)은 여전히 옳다 —
    devDependency 트리거가 실제로 충족됐다면 처방은 동일했을 것이므로 재작업이 필요하지는
    않다. 다만 **근거 문장이 거짓**인 채로 `[x]`/"완료"로 봉인돼 있어, 다음에 누군가 이
    exclude 축의 "왜"를 이 두 자리에서 읽으면 틀린 사실(devDependency 무관)을 전제로 판단하게
    된다.
  - 제안: 두 자리 모두 `76bd51aab`의 W3 서술과 동일한 정정을 미러링한다 — (1)
    `auth-guard-reflection-hardening.md` 347~350행의 "여전히 미충족"을 "이제 충족됨(같은
    배치의 후속 커밋이 `source-scan.ts`에 devDependency import 를 추가) — 처방은 이미
    같으므로 재작업 불요"로 갈고, (2) `spec-draft-nullable-notation-followups.md` 594~596행의
    "devDependency 지뢰는 없다"를 취소선 처리하고 완료 각주(602~607행)에 한 줄 추가한다.

## 요약

이번 라운드가 다루는 실제 델타(`76bd51aab`, 4라운드 `/ai-review` fix — 주석 2건 + 테스트
1건, 프로덕션 코드 0줄)는 target(`spec/5-system/`)의 §5.3/§5.4/§1.10 이 이미 확정해 둔 계약과
충돌하지 않고, 직전 라운드들이 지적한 두 WARNING(`spec_impact` 오기재, `tsconfig.build.json`
exclude 가 자매 plan 의 조건부 유예를 앞지른 것)도 원문 대조로 재확인한 결과 여전히 해소된
상태다. 다만 이번 fix 커밋(`76bd51aab`)이 스스로 "내 주석의 전제를 내 다음 커밋이
반증했다"고 진단하며 `tsconfig.build.json` 주석 한 곳만 정정하고, **같은 거짓 전제
("devDependency 트리거 미충족/무관")를 담고 있는 두 plan 문서 자리**
(`auth-guard-reflection-hardening.md` 347~350행, `spec-draft-nullable-notation-followups.md`
594~596행)는 갱신하지 않아 새로운 WARNING 을 낸다. 두 plan 의 최종 결론(추가 작업 불요)은
바뀌지 않으므로 CRITICAL 은 아니지만, 이 저장소가 반복 겪어 온 "복제된 근거 문장 중 일부만
정정" 클래스와 정확히 같은 형태라 plan 갱신을 권고한다. 그 외 미해결 결정 우회·선행 plan
미해소·후속 항목 누락은 발견되지 않았다.

## 위험도

LOW
