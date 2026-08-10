# 보안(Security) 코드 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`

두 파일 모두 CI 테스트/가드 유틸리티다. 외부 네트워크 입력·사용자 인증·DB 접근이 없고, 저장소 자신의 `plan/**`, `spec/**` 마크다운 파일(개발자가 커밋하는 신뢰된 콘텐츠)만 읽어 assertion 을 수행하는 read-only 스캐너다. 이 신뢰 모델을 전제로 분석했다.

## 발견사항

- **[INFO]** 마크다운 링크 타깃 경로가 정규화/경계 검증 없이 `path.resolve` 로 해석됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:224` (`findBrokenLinksInFiles` 내 `const resolved = path.resolve(path.dirname(f.absPath), pathPart);`), 신규 진입점은 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:302` (`findBrokenPlanLinks`)
  - 상세: `pathPart` 는 마크다운 파일 안의 링크 문자열에서 그대로 가져온 값이며 `../../../etc/passwd` 류의 상대경로 탈출을 막는 검증이 없다. 대상이 존재하면(`fs.existsSync`) `.md` 로 끝날 때 `headingSlugs()` 로 파일 내용을 읽어 헤딩 슬러그 집합을 만든다. 이론상 저장소 밖의 임의 `.md` 파일을 읽을 수 있는 경로이지만, ① 트리거하려면 이미 저장소에 write 권한이 있는 사람이 `plan/in-progress/*.md`(또는 `spec/**`) 에 그런 링크를 커밋해야 하고, ② 실제로 노출되는 정보는 원문이 아니라 헤딩 텍스트에서 계산된 slug 문자열뿐이며 그마저 `violations` 배열의 DEAD/ANCHOR 판정에만 쓰이고 slug 자체는 리포트에 출력되지 않는다(`rendered` 는 `source:line → target` 만 담음). 순수 CI 테스트 스캐너이므로 공격 표면으로서의 실질 영향은 매우 낮다.
  - 제안: 현재 신뢰 모델(레포 내부, 개발자 작성 콘텐츠)에서는 조치 불요. 이 헬퍼가 향후 외부 입력(예: PR 서드파티 fork, 사용자 제출 마크다운)에 재사용될 가능성이 생기면 그때 `resolved.startsWith(root)` 류의 경계 검사를 추가하는 것으로 충분하다.

- **[INFO]** 신규 `TERMINAL_STATUSES` 화이트리스트 방식의 상태값 검증은 안전한 패턴
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:87` (`const TERMINAL_STATUSES = new Set([...])`), 사용처 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:216`
  - 상세: `data.status` 를 `typeof status !== "string"` 로 먼저 걸러 blacklist 가 아닌 허용목록(whitelist) 비교를 쓰고 있어 예상치 못한 타입/값 주입에 안전하다. YAML frontmatter 파싱(`gray-matter` → 내부 `js-yaml`)은 이 diff 에서 신규 도입된 의존성이 아니며(`package.json` 변경 없음, 기존 `matter(raw)` 호출 재사용), 파싱 실패는 `try/catch` 로 흡수되어 에러 메시지에 원문이 노출되지 않는다. 특기사항 없음.

- **[INFO]** 에러/실패 메시지에 민감정보 노출 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:220`(`wrong.push`), `225`(assert 실패 메시지)
  - 상세: 실패 시 노출되는 값은 저장소 상대경로·프론트매터 status 문자열뿐이며, 파일 원문·시크릿·스택트레이스 등은 포함되지 않는다.

## 요약
두 파일 모두 CI 전용 read-only 마크다운 링크/프론트매터 검증 유틸리티이며, 신뢰된 저장소 콘텐츠만 스캔하고 외부 네트워크·인증·DB·시크릿을 다루지 않는다. 신규 코드(`collectLivePlanMarkdown`, `findBrokenPlanLinks`, `collectCompletedPlans`, `TERMINAL_STATUSES` 검사)는 기존 `findBrokenLinksInFiles` 공유 구현을 재사용하는 얇은 래퍼로, 인젝션·하드코딩 시크릿·인증우회·안전하지 않은 암호화 등 실질적 보안 결함은 발견되지 않았다. 경로 해석에 경계 검증이 없다는 점만 이론적 관찰로 기록했으나 현재 위협 모델(저장소 내부 신뢰 콘텐츠, read-only, slug 만 출력)에서는 익스플로잇 가능성이 사실상 없다.

## 위험도
NONE
