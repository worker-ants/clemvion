# 보안(Security) 리뷰

## 대상
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (신규 — negative-path fixture 단위 테스트)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (리팩터 — `findBrokenLinks`/`findBrokenSpecLinksInSources` 의 DEAD/ANCHOR 스캔 루프를 공유 코어 `findBrokenLinksInFiles(files, options)` 로 추출; 시그니처·외부 계약 무변경)
- `plan/in-progress/eia-context-schema-followups.md` (문서 — 체크박스/근거 갱신)

성격: CI/로컬 harness 전용 spec-link-integrity 가드(devDependency 계열 markdown 링크 검증 유틸리티) 및 이에 대한 단위 테스트 리팩터. 런타임 프로덕션 코드 경로·네트워크 엔드포인트·사용자 입력 처리와 무관하다. 대상 데이터는 저장소 내부 개발자 작성 markdown(`spec/**.md`) 및 소스 파일 주석의 상대 링크뿐이며, 외부(비신뢰) 사용자 입력이 유입되는 지점이 없다.

## 발견사항

- **[INFO]** 링크 target 경로가 traversal 검증 없이 `path.resolve` 로 해석됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:670` (`findBrokenLinksInFiles` 내부 `path.resolve(path.dirname(f.absPath), pathPart)`)
  - 상세: 마크다운 링크의 `pathPart` 를 그대로 `path.resolve` 에 넘겨 `../../..` 등으로 저장소 바깥 절대경로까지 해석 가능하다. 다만 이 함수는 (a) 존재 여부(`fs.existsSync`)와 heading anchor 매칭만 검사하고 파일 내용을 노출/실행/쓰기하지 않으며, (b) 링크 소스는 저장소 내 개발자가 작성한 spec/코드 주석뿐이라 외부 공격자가 통제하는 입력이 아니다. 실질 공격 표면 없음 — 정보성 기록.
  - 제안: 별도 조치 불요. 신규 기여자 CI 워크플로에서 fork PR 이 arbitrary markdown 을 추가할 수 있는 저장소라면(예: 외부 컨트리뷰터 fork PR 이 CI 에서 이 가드를 돌린다면) 결과가 "파일 존재 여부(boolean)" 로만 노출되므로 여전히 낮은 위험이나, 필요시 `pathPart` 가 저장소 root 밖으로 나가지 않는지(`resolved.startsWith(root)`) 방어적 assert 를 추가하는 정도로 충분.

- **[INFO]** 정규식 기반 링크 추출(`LINK_RE`, `FENCE_RE`)의 ReDoS 가능성 점검
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:522-523` (`LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g`, `FENCE_RE`)
  - 상세: 두 정규식 모두 중첩 quantifier/backtracking 폭발 패턴이 없는 단순 부정 문자 클래스(`[^\]]*`, `[^)]+`)로 구성되어 catastrophic backtracking 위험이 없다. 입력도 신뢰된 저장소 내부 파일뿐이라 DoS 표면 자체가 없음. 문제 없음 확인 차 기록.

- **[INFO]** 테스트 임시 디렉터리 생성/정리
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:65, 99, 127, 138-139`
  - 상세: `fs.mkdtempSync(os.tmpdir())` 로 격리된 임시 디렉터리를 생성하고 `afterAll`/`finally` 에서 `fs.rmSync(..., { recursive: true, force: true })` 로 확실히 정리한다. 다른 프로세스/경로와 충돌하지 않는 안전한 패턴. 문제 없음.

## 하드코딩 시크릿 / 인증·인가 / 암호화 / 에러 처리 / 의존성

- 시크릿·자격증명·토큰 하드코딩: 없음.
- 인증/인가: 해당 코드 경로에 인증·세션·권한 검사 로직 없음(적용 대상 아님).
- 암호화/해시: 사용 없음(적용 대상 아님).
- 에러 처리: `headingSlugs` 의 `try { fs.readFileSync } catch { return new Set() }` 는 광범위 catch 지만 결과가 빈 Set 으로 안전하게 축소되고, CI/로컬 개발자에게만 노출되는 내부 진단 도구라 민감정보 노출 우려 없음.
- 의존성: `mdast-util-from-markdown`, `mdast-util-to-string`, `github-slugger` 는 본 diff 로 신규 도입된 것이 아니라 기존 파일(`spec-links.ts`)이 이미 사용하던 라이브러리이며, 이번 변경은 로직 추출/테스트 추가일 뿐 의존성 변경이 없다.

## 요약

이번 변경은 spec/코드베이스 내부 markdown 링크 무결성을 검증하는 CI/로컬 전용 개발 도구(`spec-link-integrity` 가드)의 순수 리팩터(중복 스캔 루프를 옵션 파라미터화된 공유 코어로 추출)와 그에 대한 negative-path 단위 테스트 추가, 그리고 plan 문서 상태 갱신이다. 런타임 프로덕션 코드, 네트워크 인터페이스, 사용자 입력 처리, 인증/인가, 암호화, 시크릿 관리와 전혀 접점이 없으며, 처리 대상 데이터도 저장소 내부 개발자 작성 콘텐츠로 한정되어 외부 공격자 통제 입력이 유입될 경로가 없다. 파일 존재 여부만 판정하는 경로 해석 로직에 형식적인 traversal 여지가 있으나 노출/실행 부작용이 없어 실질 위험이 아니다. 보안 관점에서 조치가 필요한 발견사항 없음.

## 위험도

NONE
