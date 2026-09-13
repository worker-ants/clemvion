# 문서화(Documentation) 리뷰 — guide-identifier-existence (`#1330` → `#1331` 리네임)

## 발견사항

- **[WARNING] 리네임 스윕이 놓친 자매 파일의 죽은 참조**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
  - 상세: 이 파일의 최상단 JSDoc 이 `"자매 `guide-error-code-existence.test.ts` 는 **코드 토큰**의
    실재를 본다."` 라고 적고 있다. 그런데 이번 PR 이 `guide-error-code-existence.test.ts` 를
    삭제하고 `guide-identifier-existence.test.ts` 로 리네임했다(파일 2·3 삭제 / 파일 4·5 신설).
    `guide-error-code-existence.test.ts` 는 이제 존재하지 않는 파일이다 — 이 줄은 죽은 파일명을
    가리키는 댕글링 참조다. plan 체크리스트는 "리네임 `guide-error-code-*` → `guide-identifier-*`
    (+ `PROJECT.md` · 트래커 전방 참조 5곳...)" 를 완료로 표시했지만, 그 스윕 범위는
    `PROJECT.md` + `plan/in-progress/spec-draft-nullable-notation-followups.md` 5곳뿐이었고
    이 자매 테스트 파일의 크로스레퍼런스는 대상에서 빠졌다. `grep -rn "guide-error-code"` 를
    코드베이스 전체에 걸면 즉시 나오는 자리다.
  - 제안: `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` 로 정정.

- **[WARNING] "존재 검사 vs 방출 검사" 한계 주석 + "이 주석을 지우지 말 것" 지시가 소스에서 통째로 소실**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (파일 전체 — 삭제된
    `guide-error-code-scan.ts` 의 `## 이 가드가 **못** 보는 것 — 존재 검사이지 방출 검사가
    아니다` 절에 대응하는 자리가 신규 파일에 없음)
  - 상세: 삭제된 `guide-error-code-scan.ts` 최상단에는 이 가드의 핵심 맹점 — *"backend 소스에
    UPPER_SNAKE 문자열로 존재하는가"* 만 보고 *"실제로 `output.error.code` 로 방출되는가"* 는
    안 본다 — 를 실측 사례(`MAKESHOP_UNRESOLVED_PATH_PARAM`, catch 의 `IntegrationError` 폴백
    메커니즘, 이 가드를 만든 바로 그 PR 이 그 구멍으로 CRITICAL 을 통과시켰다는 사실, AST 대안을
    검토 후 기각한 이유)까지 담아 설명하고 있었다. 그리고 그 절 끝에 명시적으로
    `"**이 주석을 지우지 말 것**: 가드가 무엇을 보장하지 않는지가 적혀 있지 않으면 다음 사람이
    '가드가 통과했으니 이 코드는 실재한다' 로 읽는다"` 라고 못박아 뒀다. 이번 PR 이 그 파일을
    지우고 `guide-identifier-scan.ts` 로 다시 쓰면서 이 절 전체(코드 예시·실측 근거·지우지
    말라는 지시 자체)가 사라졌다 — `grep -n "MAKESHOP\|방출\|존재 검사" guide-identifier-scan.ts`
    가 0건이다. `codebase/frontend/src/lib/docs/__tests__/` 전체에서도
    `"이 주석을 지우지 말 것"` 문구는 이제 0건이다.
    이 한계 자체는 `PROJECT.md:300` 카탈로그 한 줄과
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커 항목에는 남아 있어
    지식이 완전히 유실되진 않았지만, 정작 `guide-identifier-scan.ts` 를 직접 열어 수정하는
    다음 사람이 가장 먼저 볼 자리에서는 빠졌다 — 그 절이 스스로 경고한 바로 그 실패 모드다.
  - 제안: 삭제된 절(맹점 설명 + "이 주석을 지우지 말 것")을 `guide-identifier-scan.ts` 상단
    주석에 복원한다. 식별자 축(env 변수)까지 포괄하도록 문구만 일반화하면 된다.

- **[WARNING] CHANGELOG 의 미출시(Unreleased) 항목이 이번 리네임·설계 번복을 반영하지 않음**
  - 위치: `CHANGELOG.md:66-76` (`## Unreleased — 유저 가이드가 적던 에러 코드 5종의 진위를
    맞추고, 가드로 고정한다` 섹션의 `가드 2건 추가` 블록)
  - 상세: 이 섹션은 `#1330` 시점 기록으로, 아직 `## Unreleased` 상태(버전 태그로 묶이지
    않음) — 즉 "출시 전" 이라 이번 PR 의 변경을 반영해야 정확하다. 그런데 세 가지가 지금
    시점 기준으로 이미 틀렸다: (1) 파일/가드명이 `guide-error-code-existence` 로 남아 있는데
    실제로는 `guide-identifier-existence` 로 리네임됨, (2) `**허용목록 없음**` 이라고 명시하는데
    이번 PR 이 정확히 이 원칙을 번복하고 `GUIDE_EXTERNAL_VOCABULARY` 허용목록을 도입함(plan
    §C: `"#1330 의 '허용목록 없음' 은 이번 축에서는 유지할 수 없다"`), (3)
    `"그 사유와 후속 축을 가드 주석·트래커에 적었다"` 는 문장이 가드 주석 쪽엔 더 이상 해당하지
    않는다(위 두 번째 발견사항 참조 — 그 주석이 이번 PR 에서 삭제됐다).
  - 제안: 같은 `Unreleased` 섹션에 후속 문단을 추가하거나 원문을 갱신 — 리네임된 파일명,
    허용목록 도입 사실과 4강제 요약, "가드 주석" 언급 정정.

- **[INFO] SoT 자칭이 대상 문서에 아직 반영되지 않음 (기결정 사항이나 문서화 관점에서 재확인)**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:4-5`,
    `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:25-26`
  - 상세: 두 파일 모두 `"SoT: spec/conventions/user-guide-evidence.md (가드 가족)"` 를
    명시하지만, 직접 확인한 결과(`grep -n "guide-error-code\|guide-identifier" spec/conventions/user-guide-evidence.md`
    → 0건) 그 문서의 `## 2. Build-time 가드 (3건)` 표에도 frontmatter `code:` 목록에도 이
    가드 계열 3파일이 없다. `PROJECT.md:300` 도 같은 SoT 를 자칭한다. 이 gap 은 이미
    `review/consistency/2026/09/13/12_33_41` 의 WARNING #1(cross_spec·plan_coherence 수렴)로
    포착돼 있고, `spec/` 은 developer 쓰기 권한 밖이라 `plan/in-progress/guide-identifier-existence.md`
    가 planner 턴으로 명시 위임했다(§D 표 · frontmatter 상단 안내문). 새로 지적하는 결함은
    아니지만 문서화 리뷰 관점에서 재확인: 이 gap 이 남아 있는 한 소스 코드의 "SoT" 라벨은
    현재로선 사실과 다르다.
  - 제안: 이미 등재된 planner 후속(§D #1/#2)이 처리하면 해소됨 — 별도 조치 불요, 회귀 방지용
    기록.

- **[INFO] Unicode 단어 경계(`\b`)가 한국어에서 성립하지 않는다는 디버깅 교훈이 코드베이스에서
  완전히 소실**
  - 위치: 삭제된 `guide-error-code-scan.ts` 의 `TABLE_HEADER_WITH_CODE`/`codeTableRows`
    (신규 파일에 대응 코드 없음 — 설계상 정당한 삭제)
  - 상세: 문맥-게이팅 축이 백틱 전수 축으로 교체되면서 표 헤더 판별 로직 자체가 불필요해져
    삭제된 것은 설계상 타당하다. 다만 그 코드에 달려 있던 `"JS 정규식에서 \b 는 ASCII 워드
    문자로만 정의되므로 코드 뒤에서는 경계가 성립하지 않아 한국어 헤더가 조용히 빠졌다
    (Python 으로 먼저 실측할 때는 re 가 유니코드 인식이라 통과해 차이가 안 보였다)"` 는
    재발 가능성이 있는 일반적 JS 정규식 함정이다. 코드가 삭제되며 이 교훈도 저장소 어디에도
    남지 않게 됐다(다른 정규식-경계 관례 문서 없음).
  - 제안: 낮은 우선순위. 향후 유사 정규식을 작성할 사람을 위해 `spec/conventions/` 의 규약
    문서나 이 폴더의 공유 유틸(`tree-walk.ts` 등) 근처에 한 줄 캐치롤 주석으로 옮겨 적어도
    됨 — 필수 아님.

## 요약

가드 리네임/확장(`guide-error-code-*` → `guide-identifier-*`) 자체의 신규 코드(`guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`)와 plan 문서(`plan/in-progress/guide-identifier-existence.md`)는 설계 결정·실측·기각 대안을 상세히 남겨 문서화 밀도가 높다. 하지만 "리네임을 완료했다"는 체크리스트 주장이 실제로는 좁은 스윕(PROJECT.md + 트래커 5곳)에 그쳐 자매 파일(`guide-sanitized-message-parity.test.ts`)에 죽은 파일명 참조가 남았고, 더 중요하게는 삭제된 원본 파일이 명시적으로 "지우지 말라"고 못박았던 핵심 한계 설명(존재 검사 ≠ 방출 검사, `MAKESHOP_UNRESOLVED_PATH_PARAM` 실측 사례)이 정작 재작성된 소스 파일 자체에서는 빠졌다 — 그 지식은 `PROJECT.md`와 plan 트래커에만 남아 소스와 분리됐다. CHANGELOG 의 관련 Unreleased 항목도 파일명·"허용목록 없음" 서술이 이번 PR 로 낡았는데 갱신되지 않았다. SoT 미등재(`user-guide-evidence.md`)는 이미 알려진 planner 후속이라 새 결함은 아니다.

## 위험도
MEDIUM — 빌드/테스트를 깨뜨리는 결함은 없으나, 다음 사람이 소스만 보고 판단할 때 오도될 수 있는 죽은 참조·소실된 안전장치 주석이 구체적으로 확인됐다(둘 다 grep/직접 열람으로 검증됨).
