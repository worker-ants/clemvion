# Security Review — spec-links 멀티라인 링크 매칭 수정

## 검토 범위

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 를 줄 단위 매칭에서
  마스킹된 전문(全文) 매칭으로 교체 (`LINK_RE`, `buildMaskedDoc`, `lineForOffset` 신설)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 멀티라인 링크 회귀 테스트 9건 추가
- `plan/in-progress/harness-review-gate-followups.md` — 문서 갱신 (코드 아님)
- `review/code/2026/08/29/14_36_39/*` — 직전 리뷰 라운드 산출물이 신규 파일로 커밋됨
  (RESOLUTION.md, SUMMARY.md, `_retry_state.json`, `meta.json`, 개별 리뷰어 `.md` 8건).
  전부 리뷰 메타데이터/문서이며 애플리케이션 코드가 아니다.

`extractLinks`/`headingSlugs`/`findBrokenLinksInFiles` 는 `codebase/frontend/src` 전체에서
`__tests__/spec-links` 외부의 어떤 production 코드에서도 import 되지 않음을 확인했다
(`grep -RIn "spec-links'" codebase/frontend/src` 결과 자기 자신 외 0건). 즉 이 모듈은 **빌드/테스트
시점의 저장소 자기 무결성 가드**이며, 런타임에 외부·사용자 입력을 처리하는 경로가 아니다. 이는
공격 표면을 사실상 "신뢰된 in-repo 저자가 커밋한 markdown" 으로 한정한다.

## 발견사항

- **[INFO]** 링크 타깃 경로 해석이 경로 순회(`../../..`)를 정규화/화이트리스트하지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `findBrokenLinksInFiles` 함수
    (`path.resolve(path.dirname(f.absPath), pathPart)` → `fs.existsSync(resolved)`). 이 diff 로
    변경된 줄이 아니라 기존 로직이며, 이번 PR 은 `extractLinks()` 가 돌려주는 `target` 문자열
    생성 방식만 바꿨다.
  - 상세: `pathPart` 는 리포지토리 루트 밖(`/etc/passwd` 등)으로도 `path.resolve` 될 수 있고
    결과는 `fs.existsSync` 불리언으로만 노출되지만("파일 유무"만 드러남), 입력이 저장소 자신의
    markdown(신뢰된 소스)이고 이 스캐너가 CI/테스트 컨텍스트에서만 실행되므로 실질 익스플로잇
    경로가 없다. 직전 리뷰 라운드(`14_36_39/security.md`)에서도 동일하게 INFO 로 판정됐다.
  - 제안: 조치 불요. 향후 이 스캐너가 사용자 제출 콘텐츠(예: 외부 기여자의 PR diff 본문)를
    스캔하는 방향으로 확장되면 그때 정규화/화이트리스트를 재검토한다.

- **[INFO]** 신규 `LINK_RE` 정규식은 ReDoS 위험이 없음 — 확인용 기록
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `const LINK_RE = /\[([^\]]*)\]\(([^)\n]+)\)/g;`
  - 상세: `[^\]]*` (텍스트, `]` 제외) 뒤에 `\]`, 그 뒤 `\(`, 그 뒤 `[^)\n]+` (목적지, `)`/개행 제외),
    마지막 `\)`. 두 정량자가 서로 겹치지 않는 배타적 문자 클래스(`]` 제외 vs `)`/개행 제외)를
    소비하고 중첩 정량자가 없어 catastrophic backtracking 이 성립하지 않는다. `buildMaskedDoc`
    내부의 `` /`[^`]*`/g `` 도 동일한 이유로 선형이다. 종전 구현(`[^)]+`) 대비 목적지의 개행
    불허(`[^)\n]+`)가 **의도적으로 좁힌** 것이라 오히려 공격 표면이 줄었다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 픽스처의 임시 디렉터리 사용은 안전
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 `describe` 블록들의
    `beforeAll`/`afterAll` (`fs.mkdtempSync(path.join(os.tmpdir(), ...))` / `fs.rmSync(..., { recursive: true, force: true })`)
  - 상세: `mkdtempSync` 는 예측 불가능한 유일 경로를 생성하고 각 스위트가 자기 디렉터리만
    재귀 삭제하므로 TOCTOU·심볼릭 링크 공격·경합 조건 여지가 없다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 산출물(파일 4~15)에 시크릿·자격증명 없음
  - 위치: `review/code/2026/08/29/14_36_39/` 하위 신규 파일 전체
  - 상세: 로컬 사용자 홈 경로(`/Users/gehrig/...`)가 다수 등장하나 이는 파일시스템 경로일 뿐
    API 키·토큰·비밀번호 등 시크릿 패턴은 발견되지 않았다 (`grep -RniE "api[_-]?key|secret|password|token|BEGIN (RSA|PRIVATE)"` 결과 0건, 소스 파일 기준). 리뷰 메타데이터가 커밋되는
    것 자체는 이 저장소의 `review/**` 산출물 보존 규약과 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 인증/인가·암호화·에러 처리 경로 변경 없음
  - 위치: 해당 없음 (diff 전체)
  - 상세: 이번 변경은 마크다운 문서 링크 정규식 파싱 로직과 그 회귀 테스트, plan 문서 갱신,
    이전 리뷰 라운드 산출물 커밋으로 구성되며, 인증/세션/암호화/외부 네트워크 호출/사용자
    입력 처리 코드는 일절 포함하지 않는다.
  - 제안: 조치 불요.

## 뮤테이션/재현 절차

가설 검증을 위한 별도 뮤테이션은 수행하지 않았다 — regex 형태 분석(중첩 정량자 부재, 배타적
문자 클래스)과 import 그래프 확인(`grep`)만으로 결론을 내리기에 충분했고, 저장소 트리에는
아무것도 쓰지 않았다 (`git status --short` 로 clean 확인 완료, 이 세션에서 파일을 고친 적 없음).

## 요약

이번 diff 는 순수 dev-time 문서 무결성 가드(마크다운 링크 파서)의 버그 수정과 그 회귀 테스트,
그리고 직전 리뷰 라운드 산출물의 신규 커밋으로 구성된다. 대상 모듈은 production 런타임에서
import 되지 않고 오직 저장소 자신의 신뢰된 markdown 을 빌드/테스트 시점에 스캔하므로 인젝션·
인증/인가·시크릿 노출·안전하지 않은 암호화 등 OWASP Top 10 관점의 공격 표면이 사실상 없다.
신규 정규식은 중첩 정량자가 없어 ReDoS 위험도 없다. 기존에 알려진 경로 정규화 부재(INFO)는
이 diff 의 변경 대상이 아니며 신뢰 경계상 실질 위험이 없다는 직전 라운드 판정과 일치한다.

## 위험도
NONE
