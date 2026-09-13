# 부작용(Side Effect) 리뷰

## 검증 방법

이 라운드(`15_03_06`)는 직전 라운드(`review/code/2026/09/13/14_41_14`)의 side_effect 리뷰가 지적한
WARNING 2건에 대한 RESOLUTION 적용 diff를 포함한다. 저장소를 뮤테이션하지 않고 실제 워크트리
파일을 `Read`/`grep`으로 직접 열람해 그 WARNING들이 실제로 해소됐는지, 그리고 해소 과정에서
새 부작용이 생기지 않았는지 교차검증했다.

- `grep -rn "guide-error-code" codebase/ spec/ PROJECT.md CHANGELOG.md plan/` — 잔존 참조 전수 확인
- `ls codebase/frontend/src/lib/docs/__tests__/ | grep -i guide` — 신구 파일 공존(중복 테스트 등록) 여부 확인
- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` — 26/26 통과
- `git status --short` — 이번 세션이 만든 것은 `review/code/2026/09/13/15_03_06/`·`review/consistency/2026/09/13/15_03_36/` 산출물뿐, 코드 트리에 잔여 뮤테이션 없음

## 발견사항

- **[INFO] (해소 확인) 자매 파일의 죽은 파일명 참조 — 직전 라운드 WARNING이 정정됨**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
  - 상세: 직전 라운드(`14_41_14`) side_effect 리뷰가 이 줄이 삭제된 `guide-error-code-existence.test.ts`
    를 현재형으로 계속 인용한다고 WARNING 처리했다. 이번 diff(파일 7)에서 `자매
    \`guide-identifier-existence.test.ts\`(\`#1330\` 당시 \`guide-error-code-existence.test.ts\`)는`
    로 정정됐고, 옛 이름은 각주 형태(역사 서술)로만 남아 있다. 직접 파일을 열어 확인 완료.
    `grep -rn "guide-error-code" codebase/`의 잔존 히트는 이 각주와 `guide-identifier-scan.ts:9`의
    의도된 역사 서술 두 곳뿐이며 둘 다 죽은 파일명을 가리키는 댕글링 참조가 아니다.
  - 제안: 없음(정보성) — 재발 방지를 위해 이번에도 "리네임 시 자매 파일 내부 문구까지 전수 grep"
    이 필요했다는 패턴이 반복됐다는 점만 기록.

- **[INFO] (해소 확인) `composeTexts`가 저장소 루트의 임의 YAML을 읽던 문제 — 명시적 패턴으로 좁혀짐**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:53-56`
  - 상세: 직전 라운드에서 `fs.readdirSync(root).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))`
    이 `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml`까지 매 테스트 실행마다 읽어 정규식으로
    스캔하는 것을 WARNING으로 지적했다. 이번 diff는 `.filter((f) => /^docker-compose.*\.ya?ml$/.test(f))`
    로 좁혔고, 그 옆 주석에 이전 판의 문제와 실측(오늘 매치 0건, 그럼에도 범위가 넓었다는 사실)을
    남겨 재발 방지 근거까지 기록했다. `readdirSync`의 대상은 여전히 저장소 루트(`repoRoot()`)이지만
    필터가 파일명 패턴으로 명시됐으므로 "이름·문서가 약속한 범위보다 구현이 넓다"는 부작용 클래스는
    해소됐다.
  - 제안: 없음(정보성).

- **[INFO] 새 모듈은 여전히 순수 함수 + 읽기 전용 파일시스템 접근으로만 구성됨 (재확인)**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체,
    `guide-identifier-existence.test.ts` 전체
  - 상세: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두 인자로 받은
    텍스트만 다루는 순수 함수이고, 부작용은 `fs.readFileSync`/`fs.readdirSync`/`fs.existsSync`를
    통한 **읽기**뿐이다. 이번 RESOLUTION diff가 추가한 주석·회귀 fixture(`discord.en.mdx`/
    `EXECUTION_TIMEOUT`, `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL`을 이름으로 고정하는 신규
    `it("실제 코퍼스의 특정 파일·토큰을 이름으로 고정한다", ...)`)도 기존 `citations` 배열을
    필터링해 읽는 것뿐이라 새 부작용 표면을 추가하지 않는다. 쓰기·삭제·네트워크 호출·
    `process.env` 변경·전역 변수 신설은 이번 diff에도 없다.
  - 제안: 없음(정보성).

- **[INFO] 옛 파일 삭제에 따른 깨진 참조/중복 테스트 등록 없음 (재확인)**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/` 디렉터리 전체
  - 상세: `ls codebase/frontend/src/lib/docs/__tests__/ | grep -i guide` 결과 `guide-error-code-*` 두
    파일은 완전히 사라졌고 `guide-identifier-*` 두 파일만 남아 있다 — 신구가 동시에 존재해 vitest가
    같은 축을 두 번 실행하는 상태가 아니다. `vitest run`으로 26/26 통과를 직접 확인했다(가드
    자체 18건 + 자매 `guide-sanitized-message-parity` 8건 추정 합계, 실제로는 상단 describe 기준
    분리 카운트).
  - 제안: 없음(정보성).

- **[INFO] `PROJECT.md`/`CHANGELOG.md` 카탈로그 문구가 코드 상태와 일치 (재확인)**
  - 위치: `PROJECT.md:300`, `CHANGELOG.md:66-81`
  - 상세: 직전 라운드 documentation 리뷰가 CHANGELOG의 옛 파일명·"허용목록 없음" 서술이 낡았다고
    WARNING 처리했다. 이번 diff에서 두 문서 모두 `guide-identifier-existence`·
    `GUIDE_EXTERNAL_VOCABULARY` 4강제·"두 PR에 걸쳐 두 번 바뀐 경위"를 반영해 코드 상태와
    부합한다. 이는 side-effect 관점의 "인터페이스 변경이 문서에 반영됐는가"에 해당하며 정합
    확인됨.
  - 제안: 없음(정보성).

## 뮤테이션/원복 메모

이번 검증은 전부 `Read`/`grep`/`vitest run`(읽기 전용)으로만 수행했다. 저장소 트리에 쓰기·삭제를
가하지 않았다. `git status --short` 확인 결과 이 세션이 만든 것은 `review/code/2026/09/13/15_03_06/`,
`review/consistency/2026/09/13/15_03_36/` 산출물 디렉터리뿐이다.

## 요약

이번 diff는 순수 test/tooling 리팩터에 대한 **RESOLUTION 적용**으로, 직전 라운드(`14_41_14`)
side_effect 리뷰가 지적한 두 WARNING(자매 파일의 죽은 파일명 참조, `composeTexts`의 의도보다
넓은 파일 읽기 범위)이 실제 워크트리에서 정확히 해소됐음을 직접 열람으로 확인했다. 새로 추가된
코드(회귀 fixture 이름 고정 테스트 1건, 주석 확장)는 기존과 동일하게 순수 함수 + 읽기 전용
파일시스템 접근 패턴을 유지하며, 시그니처 변경·전역 상태·환경변수 쓰기·네트워크 호출·신규
부작용 표면을 도입하지 않는다. 옛 가드 파일(`guide-error-code-*`) 삭제에 따른 깨진 참조나 중복
테스트 등록도 없다. 이번 라운드에서 side-effect 관점으로 새로 지적할 CRITICAL/WARNING 항목은
없다.

## 위험도

NONE
