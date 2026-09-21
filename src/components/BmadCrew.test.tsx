import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BmadCrew, CrewMember } from './BmadCrew';

describe('BmadCrew', () => {
  const defaultMembers: CrewMember[] = [
    { id: '1', name: 'Amelia', role: 'Senior Engineer', avatar: '', status: 'online' },
    { id: '2', name: 'Buddy', role: 'QA Specialist', avatar: '', status: 'busy' },
    { id: '3', name: 'Charlie', role: 'DevOps', avatar: '', status: 'offline' },
  ];

  it('should render the crew title', () => {
    render(<BmadCrew />);
    expect(screen.getByRole('heading', { name: /BMAD Crew/i })).toBeInTheDocument();
  });

  it('should render all default crew members', () => {
    render(<BmadCrew />);
    defaultMembers.forEach((member) => {
      expect(screen.getByText(member.name)).toBeInTheDocument();
      expect(screen.getByText(member.role)).toBeInTheDocument();
    });
  });

  it('should render custom crew members when provided', () => {
    const customMembers: CrewMember[] = [
      { id: '10', name: 'Dana', role: 'Designer', avatar: '', status: 'online' },
    ];
    render(<BmadCrew crewMembers={customMembers} />);
    expect(screen.getByText('Dana')).toBeInTheDocument();
    expect(screen.getByText('Designer')).toBeInTheDocument();
  });

  it('should show the first letter as avatar placeholder when no avatar', () => {
    render(<BmadCrew />);
    expect(screen.getByText('A')).toBeInTheDocument(); // Amelia
  });

  it('should apply correct status color classes', () => {
    render(<BmadCrew />);
    const listItems = screen.getAllByRole('listitem');
    const firstStatus = listItems[0].querySelector('.bmad-crew__status');
    expect(firstStatus).toHaveClass('bg-green-400'); // Amelia is online
  });

  it('should call onMemberClick when a member is clicked', () => {
    const handleClick = jest.fn();
    render(<BmadCrew crewMembers={defaultMembers} onMemberClick={handleClick} />);
    const firstItem = screen.getAllByRole('listitem')[0];
    userEvent.click(firstItem);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(defaultMembers[0]);
  });

  it('should mark the selected member with the selected class', () => {
    render(<BmadCrew crewMembers={defaultMembers} />);
    const firstItem = screen.getAllByRole('listitem')[0];
    userEvent.click(firstItem);
    expect(firstItem).toHaveClass('bmad-crew__item--selected');
  });

  it('should apply correct status for busy and offline members', () => {
    render(<BmadCrew />);
    const listItems = screen.getAllByRole('listitem');
    // Buddy (index 1) is busy -> bg-red-400
    expect(listItems[1].querySelector('.bmad-crew__status')).toHaveClass('bg-red-400');
    // Charlie (index 2) is offline -> bg-gray-400
    expect(listItems[2].querySelector('.bmad-crew__status')).toHaveClass('bg-gray-400');
  });

  it('should render avatar image when avatar URL is provided', () => {
    const membersWithAvatar: CrewMember[] = [
      { id: '1', name: 'Amelia', role: 'Senior Engineer', avatar: 'https://example.com/avatar.png', status: 'online' },
    ];
    render(<BmadCrew crewMembers={membersWithAvatar} />);
    const img = screen.getByAltText('Amelia');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
  });

  it('should have correct ARIA labels on list items', () => {
    render(<BmadCrew />);
    const firstItem = screen.getAllByRole('listitem')[0];
    expect(firstItem).toHaveAttribute('aria-label', 'Amelia - Senior Engineer');
  });
});
