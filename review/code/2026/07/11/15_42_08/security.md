# 보안(Security) 리뷰 — spec-links.ts 중복 제거 리팩터링

## 대상
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `findBrokenLinks` / `findBrokenSpecLinksInSources` 두 함수의 중복 DEAD/ANCHOR 스캔 로직을 `findBrokenLinksInFiles` 공용 헬퍼로 통합하는 순수 리팩터링(behavior-preserving dedup). 신규 로직·신규 입력 경로 없음.

## 컨텍스트 (위협 모델)

이 파일은 `__tests__/` 하위의 **테스트 전용 정적 분석 유틸리티**로, CI/로컬 테스트 harness 에서만 실행되며 다음 두 진입점을 노출한다.

- `findBrokenLinks(root)` — `spec/**/*.md` 전수 스캔.
- `findBrokenSpecLinksInSources(root)` — `codebase/{backend,frontend,channel-web-chat}/src`, `codebase/packages` 하위 `.ts`/`.tsx` 소스의 spec 링크 스캔.

두 경우 모두 입력은 **저장소 자체에 이미 커밋된 markdown/TS 소스**(개발자가 작성)이며, 외부 네트워크 요청, 사용자 입력, 인증된 세션 등 신뢰 경계를 넘는 입력이 없다. 즉 공격자가 이 코드 경로에 영향을 주려면 이미 저장소에 커밋 권한(= 코드베이스 자체에 대한 신뢰)이 있어야 하므로, 고전적 웹 애플리케이션 공격 표면(SQLi/XSS/CSRF/인증 우회 등)은 해당하지 않는다.

## 발견사항

- **[INFO]** 링크 타깃 경로 해석이 저장소 루트 바깥으로도 `path.resolve` 될 수 있음 (기존 동작, 이번 diff 로 신규 도입 아님)
  - 위치: `findBrokenLinksInFiles` 내 `const resolved = path.resolve(path.dirname(f.absPath), pathPart);` (구 코드에서도 동일 패턴이 `findBrokenLinks`/`findBrokenSpecLinksInSources` 양쪽에 이미 존재했고, 이번 diff 는 두 구현을 병합했을 뿐 로직은 변경하지 않음)
  - 상세: markdown 링크 타깃에 `../../../etc/passwd` 같은 문자열이 있으면 `path.resolve` 가 저장소 바깥 경로로 해석되고, `fs.existsSync`/`headingSlugs`(`fs.readFileSync`) 가 그 경로를 그대로 조회·읽는다. 이는 형식적으로는 경로 탐색(path traversal) 패턴이지만, 이 도구는 (a) 테스트 전용 CI 스크립트이고, (b) 스캔 대상이 이미 저장소에 커밋된 신뢰된 콘텐츠이며, (c) 결과는 콘솔/테스트 출력으로만 노출되고 외부로 전송되지 않으므로 실질적 악용 경로가 없다. `fs.readFileSync` 실패는 `headingSlugs` 에서 `catch { return new Set() }` 로 조용히 흡수되어 에러 메시지 노출도 없다.
  - 제안: 별도 조치 불요. 향후 이 유틸리티를 사용자 입력(예: 업로드된 markdown)에 대해 실행하도록 재사용할 계획이 생긴다면, 그때 `resolved` 가 `root` 하위인지 (`resolved.startsWith(root)`) 검증하는 가드를 추가할 것.

- **[INFO]** 공용 헬퍼 병합 후 동작 동등성
  - 위치: `findBrokenLinksInFiles` (신규), `findBrokenLinks`/`findBrokenSpecLinksInSources` (호출부)
  - 상세: `checkSelfAnchors`/`targetFilter` 옵션으로 두 개의 기존 스캔 루프를 합친 리팩터링으로, 보안 관련 검증 로직(경로 존재 확인, 앵커 slug 검증, `isExternal` 외부 링크 스킵)은 그대로 보존되어 있다. slug 캐시(`slugCache`/`slugsFor`)도 파일별 캐싱 방식을 유지해 정보 누출이나 캐시 오염 문제는 없다. `SPEC_MD_TARGET_RE` 필터(`targetFilter`)는 코드 소스 스캔을 spec 문서 링크로만 제한하던 기존 동작을 그대로 옵션화한 것으로 검증 범위 축소는 없다.
  - 제안: 없음 (참고용).

## 요약

이번 변경은 테스트 전용 markdown/spec-link 무결성 검사 유틸리티 내부의 중복 스캔 로직을 하나의 공용 헬퍼로 통합하는 리팩터링으로, 신규 외부 입력 경로·인증/인가 로직·시크릿·암호화·네트워크 통신이 전혀 관여하지 않는다. 기존에도 존재하던 (저장소 신뢰 콘텐츠 기반) 경로 해석 방식이 그대로 유지되었을 뿐 검증 로직의 범위나 강도가 약화되지 않았고, 에러 처리도 민감 정보 노출 없이 조용히 빈 값으로 대체된다. OWASP Top 10 관점에서 해당 사항 없음.

## 위험도
NONE
