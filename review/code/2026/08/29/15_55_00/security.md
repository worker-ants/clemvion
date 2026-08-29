# 보안(Security) Review

## 발견사항

- **[INFO]** `findBrokenLinksInFiles` 의 경로 해석이 `path.resolve` + `fs.existsSync` 로 임의의 상대 경로를 그대로 따라간다 (경로 컴포넌트에 대한 별도 화이트리스트/정규화 없음).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:331`-`332` (`const resolved = path.resolve(path.dirname(f.absPath), pathPart); if (!fs.existsSync(resolved))`)
  - 상세: 형식적으로는 경로 탐색(path traversal) 패턴과 닮았지만, 실제 트러스트 경계를 보면 익스플로잇 가능성이 없다. (1) 입력(`pathPart`)은 네트워크·사용자 입력이 아니라 **저장소에 이미 커밋된 마크다운 파일의 링크 텍스트**이고, 그 마크다운을 쓸 수 있는 주체는 이미 저장소 쓰기 권한을 가진 신뢰된 기여자다. (2) 이 모듈(`spec-links.ts`)은 `codebase/frontend/src/lib/docs/__tests__/` 안에만 존재하며, `grep` 결과 이 디렉터리 밖(런타임 프로덕션 코드·API 라우트)에서 import 하는 곳이 전혀 없다 — vitest 로 실행되는 빌드/CI 타임 문서 링크 가드일 뿐, 외부에 노출되는 서비스 코드가 아니다. (3) 해석 결과에 대해 하는 일은 `fs.existsSync` 존재 확인뿐이고, 파일 내용을 읽거나 응답에 실어 보내는 동작이 없어 정보 노출 경로도 없다. 따라서 이론적 형태는 경로 탐색이지만 공격 가능한 표면이 아니다.
  - 제안: 조치 불요. 향후 이 헬퍼가 사용자 입력이나 런타임 요청 경로를 다루는 곳으로 재사용될 경우에만 정규화/화이트리스트를 추가하면 된다.

- **[INFO]** 정규식 표현(`LINK_RE`, `FENCE_RE`, `SPEC_MD_TARGET_RE`, 제목 파싱용 `/^(\S+)(\s+"[^"]*")?$/`)에 중첩 정량자(nested quantifier)가 없어 ReDoS 형태의 이차·지수 백트래킹 위험이 없음을 확인.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82`-`83`, `:470`, `:218`
  - 상세: 모두 단순 문자 클래스 기반(`[^\]]*`, `[^)\n]+`, `.+\.md$` 등)이라 겹치는 하위 매치 폭발이 일어나지 않는다. 입력도 위와 같은 이유로 신뢰된 저장소 파일이라 공격 벡터가 아니지만, 정적으로도 안전한 형태다.
  - 제안: 조치 불요 (긍정적 확인).

- **[INFO]** 이 PR 범위 전체(`spec-links.ts`/`spec-links.test.ts`, `plan/in-progress/harness-review-gate-followups.md`, `review/code/2026/08/29/14_36_39/**` 리뷰 산출물)에서 하드코딩된 시크릿·자격증명·인증/인가 로직·암호화 프리미티브·네트워크 I/O·SQL/커맨드 실행이 전혀 없음을 확인. `review/code/2026/08/29/14_36_39/**` 는 이전 라운드 리뷰 산출물(RESOLUTION.md, SUMMARY.md, meta.json 등)이며 코드 실행 경로가 아니다.
  - 위치: 전체 diff
  - 제안: 조치 불요.

## 요약

이번 변경은 리포지토리 자체의 마크다운 링크(`spec/**`, 거버넌스 문서, plan)를 CI/테스트 시점에 검증하는 내부 dev-tool(`extractLinks`/`buildMaskedDoc`/`findBrokenLinksInFiles`)의 버그 수정(멀티라인 링크 사각지대 해소)이다. 이 모듈은 `__tests__/` 스코프 밖에서 import 되지 않아 프로덕션 런타임이나 외부 요청을 처리하지 않으며, 입력도 이미 저장소 쓰기 권한을 가진 기여자가 작성한 로컬 파일뿐이다. `path.resolve`+`fs.existsSync` 조합이 형식적으로 경로 탐색 패턴과 닮았고 정규식이 여럿 새로 추가됐지만, 트러스트 경계·읽기 전용 존재-확인 성격·정규식 형태(중첩 정량자 없음)를 모두 확인한 결과 실질적으로 공격 가능한 표면이 없다. 하드코딩된 시크릿, 인증/인가 로직, 암호화, 에러 메시지의 민감정보 노출, 취약 의존성 등 다른 OWASP Top 10 항목에도 해당 사항이 없다.

## 위험도

NONE
