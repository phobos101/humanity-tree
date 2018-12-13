import PropTypes from 'prop-types';
import Header from '../components/Header';

const layoutStyle = {
	margin: 20,
	padding: 20,
	border: '1px solid #DDD',
};

const Layout = (props) => {
	const { children } = props;
	return (
		<div style={layoutStyle}>
			<Header />
			{children}
		</div>
	);
};

Layout.propTypes = {
	children: PropTypes.element.isRequired,
};

export default Layout;
